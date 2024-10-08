/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { spec } from "./factory.js"
import { Icon } from "./icon.js"
import { Rational, zero, one } from "./rational.js"

export class Ingredient {
    constructor(item, amount) {
        this.item = item
        this.amount = amount
    }
}

class Recipe {
    constructor(key, name, category, time, ingredients, products) {
        this.key = key
        this.name = name
        this.category = category
        this.time = time
        this.ingredients = ingredients
        for (let ing of ingredients) {
            ing.item.addUse(this)
        }
        this.products = products
        for (let ing of products) {
            ing.item.addRecipe(this)
        }
        this.icon = new Icon(this, products[0].item.name)
    }
    gives(item) {
        let sloopFraction = spec.getSomersloop(this)
        for (let ing of this.products) {
            if (ing.item === item) {
                if (!sloopFraction.isZero()) {
                    // The prod bonus is based on the *net* output from the
                    // recipe, not the bare yield.
                    let net = ing.amount.sub(this.uses(item))
                    if (net.less(zero)) {
                        return ing.amount
                    }
                    return ing.amount.add(net.mul(sloopFraction))
                }
                return ing.amount
            }
        }
        throw new Error("recipe does not give item")
    }
    // There's an asymmetry with gives() here: It returns zero if the recipe
    // does not have this item as an ingredient.
    uses(item) {
        for (let ing of this.ingredients) {
            if (ing.item === item) {
                return ing.amount
            }
        }
        return zero
    }
    isNetProducer(item) {
        let amount = this.gives(item)
        return zero.less(amount.sub(this.uses(item)))
    }
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    isDisable() {
        return false
    }
    renderTooltip() {
        let t = d3.create("div")
            .classed("frame recipe", true)
            .datum(this)
        renderRecipe(t)
        return t.node()
    }
}

function renderIngredient(ingSpan) {
    ingSpan.classed("ingredient", true)
        .attr("title", d => d.item.name)
        .append(d => d.item.icon.make(32))
    ingSpan.append("span")
        .classed("count", true)
        .text(d => spec.format.count(d.amount))
}

export function renderRecipe(div) {
    div.classed("recipe", true)
    div.append("span")
        .classed("title", true)
        .text(d => d.name)
    div.append("br")
    let productSpan = div.append("span")
        .selectAll("span")
        .data(d => d.products)
        .join("span")
    renderIngredient(productSpan)
    div.append("span")
        .classed("arrow", true)
        .text("\u21d0")
    let ingredientSpan = div.append("span")
        .selectAll("span")
        .data(d => d.ingredients)
        .join("span")
    renderIngredient(ingredientSpan)
}

export const DISABLED_RECIPE_PREFIX = "D-"

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe {
    constructor(item) {
        this.key = DISABLED_RECIPE_PREFIX + item.key
        this.name = item.name
        this.category = null
        this.ingredients = []
        this.products = [new Ingredient(item, one)]
        this.icon = new Icon(this)
    }
    gives(item) {
        for (let ing of this.products) {
            if (ing.item === item) {
                return ing.amount
            }
        }
        return null
    }
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    isDisable() {
        return true
    }
}

function makeRecipe(data, items, d) {
    let time = Rational.from_float(d.time)
    let products = []
    for (let [item_key, amount] of d.products) {
        let item = items.get(item_key)
        products.push(new Ingredient(item, Rational.from_float(amount)))
    }
    let ingredients = []
    for (let [item_key, amount] of d.ingredients) {
        let item = items.get(item_key)
        ingredients.push(new Ingredient(item, Rational.from_float(amount)))
    }
    return new Recipe(d.key_name, d.name, d.category, time, ingredients, products)
}

class ResourceRecipe extends Recipe {
    constructor(item, category, priority, weight) {
        super(item.key, item.name, category, zero, [], [new Ingredient(item, one)])
        this.defaultPriority = priority
        this.defaultWeight = weight
    }
    isResource() {
        return true
    }
}

export function getRecipes(data, items) {
    let recipes = new Map()
    for (let d of data.resources) {
        let item = items.get(d.key_name)
        recipes.set(d.key_name, new ResourceRecipe(item, d.category, d.priority, Rational.from_float(d.weight)))
    }
    for (let d of data.recipes) {
        recipes.set(d.key_name, makeRecipe(data, items, d))
    }
    let hundred = Rational.from_float(100)
    for (let [itemKey, item] of items) {
        if (item.recipes.length === 0) {
            console.log("item with no recipes:", item)
            recipes.set(itemKey, new ResourceRecipe(item, null, 2, hundred))
        }
    }
    return recipes
}
