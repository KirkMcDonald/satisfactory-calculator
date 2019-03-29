/*Copyright 2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { Totals } from "./totals.js"

export class Item {
    constructor(key, index, name) {
        this.key = key
        this.index = index
        this.name = name
        this.recipes = []
        this.uses = []
    }
    addRecipe(recipe) {
        this.recipes.push(recipe)
    }
    addUse(recipe) {
        this.uses.push(recipe)
    }
    produce(rate) {
        let totals = new Totals()
        // XXX
        let recipe = this.recipes[0]
        let gives = recipe.gives(this)
        rate = rate.div(gives)
        totals.add(recipe, rate)
        for (let ing of recipe.ingredients) {
            let subtotals = ing.item.produce(rate.mul(ing.amount))
            totals.combine(subtotals)
        }
        totals.updateHeight(recipe, 0)
        return totals
    }
}

export function getItems(data) {
    let items = new Map()
    for (let d of data.items) {
        items.set(d.key_name, new Item(d.key_name, d.index, d.name))
    }
    return items
}
