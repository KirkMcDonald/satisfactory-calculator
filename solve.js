/*Copyright 2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

import { getCycleRecipes } from "./cycle.js"
import { Matrix } from "./matrix.js"
import { Rational, minusOne, zero, one } from "./rational.js"
import { Ingredient } from "./recipe.js"
import { simplex } from "./simplex.js"
import { Totals } from "./totals.js"

// Terminating nodes of a solution-graph.
class OutputRecipe {
    constructor(outputs) {
        this.name = "output"
        this.ingredients =  []
        for (let [item, rate] of outputs) {
            this.ingredients.push(new Ingredient(item, rate))
        }
        this.products = []
    }
    isReal() {
        return false
    }
}

class SurplusRecipe extends OutputRecipe {
    constructor(output) {
        super(output)
        this.name = "surplus"
    }
}

class Result {
    constructor() {
        this.recipeRates = new Map()
        this.remaining = new Map()
    }
    add(recipe, rate) {
        let x = this.recipeRates.get(recipe) || zero
        this.recipeRates.set(recipe, x.add(rate))
    }
    remainder(item, rate) {
        let x = this.remaining.get(item) || zero
        this.remaining.set(item, x.add(rate))
    }
    combine(other) {
        for (let [recipe, rate] of other.recipeRates) {
            this.add(recipe, rate)
        }
        for (let [item, rate] of other.remaining) {
            this.remainder(item, rate)
        }
    }
}

function traverse(spec, cyclic, item, rate) {
    let result = new Result()
    let itemRecipes = spec.getRecipes(item)
    if (itemRecipes.length > 1 || itemRecipes[0].products.length > 1 || cyclic.has(itemRecipes[0])) {
        result.remainder(item, rate)
        return result
    }
    let recipe = itemRecipes[0]
    let gives = recipe.gives(item)
    let recipeRate = rate.div(gives)
    result.add(recipe, recipeRate)
    if (spec.ignore.has(item)) {
        console.log("ignored:", item)
        return result
    }
    for (let ing of recipe.ingredients) {
        let sub = traverse(spec, cyclic, ing.item, recipeRate.mul(ing.amount))
        result.combine(sub)
    }
    return result
}

function recursiveSolve(spec, cyclic, outputs) {
    let result = new Result()
    for (let [item, rate] of outputs) {
        let sub = traverse(spec, cyclic, item, rate)
        result.combine(sub)
    }
    return result
}

/* Tableau layout:

Columns:
[surplus items] [tax] [recipes] [result] [cost]

Rows:
[recipes]
[tax]
[result]
*/

export function solve(spec, outputs) {
    let recipes = spec.getRecipeGraph(outputs)
    let cyclic = getCycleRecipes(recipes)
    let partialSolution = recursiveSolve(spec, cyclic, outputs)
    let solution = partialSolution.recipeRates
    spec.lastPartial = partialSolution

    if (partialSolution.remaining.size === 0) {
        spec.lastTableau = null
        spec.lastMetadata = null
        spec.lastSolution = null
        solution.set(new OutputRecipe(outputs), one)
        return new Totals(spec, outputs, solution, new Map())
    }

    recipes = spec.getRecipeGraph(partialSolution.remaining)

    let products = new Set()
    let ingredients = new Set()

    let items = []
    let itemColumns = new Map()
    let recipeArray = []
    let recipeRows = new Map()
    /*
    // A subtlety: If all recipes for an item are disabled, we still need to
    // include the item in the tableau. We represent this with a pseudo-recipe
    // that produces the item at no cost, but placed at the highest-possible
    // priority, so that any solution which does not involve it is considered
    // first.
    //let disabledItems = []
    */
    let maxPriorityRecipes = []

    for (let recipe of recipes) {
        recipeRows.set(recipe, recipeArray.length)
        recipeArray.push(recipe)
        for (let ing of recipe.products) {
            if (!products.has(ing.item)) {
                itemColumns.set(ing.item, items.length)
                items.push(ing.item)
            }
            products.add(ing.item)
        }
        if (recipe.maxPriority()) {
            maxPriorityRecipes.push(recipe)
        }
    }
    /*for (let recipe of recipes) {
        for (let ing of recipe.ingredients) {
            if (!products.has(ing.item) && !ingredients.has(ing.item)) {
                itemColumns.set(ing.item, items.length)
                items.push(ing.item)
                //disabledItems.push(ing.item)
            }
            ingredients.add(ing.item)
        }
    }*/

    let columns = items.length + recipeArray.length + /*disabledItems.length +*/ 3
    let rows = recipeArray.length + /*disabledItems.length +*/ 2
    let A = new Matrix(rows, columns)

    let tax = items.length

    // Set recipe inputs/outputs
    for (let i = 0; i < recipeArray.length; i++) {
        let recipe = recipeArray[i]
        for (let ing of recipe.products) {
            let j = itemColumns.get(ing.item)
            A.setIndex(i, j, ing.amount)
        }
        for (let ing of recipe.ingredients) {
            let j = itemColumns.get(ing.item)
            A.addIndex(i, j, zero.sub(ing.amount))
        }
        A.setIndex(i, tax, minusOne)
        A.setIndex(i, tax + i + 1, one)
    }
    /*for (let i = 0; i < disabledItems.length; i++) {
        let row = recipeArray.length + i
        A.setIndex(row, itemColumns.get(item), one)
        A.setIndex(row, tax, minusOne)
        A.setIndex(row, products.size + row, one)
    }*/
    A.setIndex(rows - 2, tax, one)
    A.setIndex(rows - 1, columns - 2, one)

    // Set target rates
    for (let [item, rate] of partialSolution.remaining) {
        let col = itemColumns.get(item)
        A.setIndex(rows - 1, col, zero.sub(rate))
    }

    // Set cost function
    let min = null
    let max = zero
    for (let x of A.mat) {
        if (x.isZero()) {
            continue
        }
        x = x.abs()
        if (min === null || x.less(min)) {
            min = x
        }
        if (max.less(x)) {
            max = x
        }
    }
    let two = Rational.from_float(2)
    let cost_ratio = max.div(min).mul(two)
    // The cost ratio must be greater than 1.
    if (cost_ratio.less(two)) {
        cost_ratio = two
    }
    A.setIndex(rows - 2, columns - 1, one)
    let P = cost_ratio
    for (let p of spec.priority) {
        let N = zero
        let maxWeight = null
        for (let [recipe, weight] of p.recipes) {
            if (maxWeight === null || maxWeight.less(weight)) {
                maxWeight = weight
            }
        }
        for (let [recipe, weight] of p.recipes) {
            if (recipeRows.has(recipe)) {
                let normalizedWeight = maxWeight.div(weight)
                N = N.add(normalizedWeight)
                A.setIndex(recipeRows.get(recipe), columns - 1, P.mul(normalizedWeight))
            }
        }
        if (!N.isZero()) {
            P = P.mul(cost_ratio).mul(N)
        }
    }
    //for (let i = recipeArray.length; i < recipeArray.length + disabledItems.length; i++) {
    for (let recipe of maxPriorityRecipes) {
        let i = recipeRows.get(recipe)
        A.setIndex(i, columns - 1, P)
    }

    spec.lastTableau = A.copy()
    spec.lastMetadata = {
        "items": items,
        "recipes": recipeArray,
        //"disabledItems": disabledItems,
    }

    // Solve.
    simplex(A)

    spec.lastSolution = A

    // Convert result to map of recipe to recipe-rate.
    //let solution = new Map()
    for (let i = 0; i < recipeArray.length; i++) {
        let col = items.length + i + 1
        let rate = A.index(A.rows - 1, col)
        if (zero.less(rate)) {
            let recipe = recipeArray[i]
            solution.set(recipe, (solution.get(recipe) || zero).add(rate))
        }
    }
    solution.set(new OutputRecipe(outputs), one)
    // And to map of surplus item to rate.
    let surplus = new Map()
    for (let i = 0; i < items.length /*- disabledItems.length*/; i++) {
        let rate = A.index(A.rows - 1, i)
        if (zero.less(rate)) {
            surplus.set(items[i], rate)
        }
    }
    if (surplus.size > 0) {
        solution.set(new SurplusRecipe(surplus), one)
    }
    return new Totals(spec, outputs, solution, surplus)
    //return {"solution": solution, "surplus": surplus}
}
