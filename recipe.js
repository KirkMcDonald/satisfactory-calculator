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
        this.icon = new Icon(products[0].item.name, name)
    }
    gives(item) {
        for (let ing of this.products) {
            if (ing.item === item) {
                return ing.amount
            }
        }
        return null
    }
    netGives(item) {
        let amount = this.gives(item)
        if (amount === null) {
            return null
        }
        for (let ing of this.ingredients) {
            if (ing.item === item) {
                return amount.sub(ing.amount)
            }
        }
        return amount
    }
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    maxPriority() {
        return false
    }
}

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe {
    constructor(item, max) {
        this.name = item.name
        this.category = null
        this.ingredients = []
        this.products = [new Ingredient(item, one)]
        this.max = max
        this.icon = new Icon(this.name)
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
    maxPriority() {
        return this.max
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
