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
import { DisabledRecipe } from "./recipe.js"
import { Totals } from "./totals.js"

export class Item {
    constructor(key, name, tier, phase) {
        this.key = key
        this.name = name
        this.tier = tier
        this.phase = phase
        this.recipes = []
        this.uses = []
        this.icon = new Icon(name)

        this.disableRecipe = new DisabledRecipe(this)
    }
    addRecipe(recipe) {
        this.recipes.push(recipe)
    }
    addUse(recipe) {
        this.uses.push(recipe)
    }
}

export function getItems(data) {
    let items = new Map()
    for (let d of data.items) {
        items.set(d.key_name, new Item(d.key_name, d.name, d.tier, "solid"))
    }
    for (let d of data.fluids) {
        items.set(d.key_name, new Item(d.key_name, d.name, d.tier, "fluid"))
    }
    return items
}
