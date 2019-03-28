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
import { Formatter } from "./align.js"
import { displayItems } from "./display.js"
import { formatSettings } from "./fragment.js"
import { Rational, half, one } from "./rational.js"
import { BuildTarget } from "./target.js"
import { Totals } from "./totals.js"
import { renderTotals } from "./visualize.js"

const DEFAULT_ITEM_KEY = "supercomputer"

let minerCategories = new Set(["mineral", "oil"])

let resourcePurities = [
    {name: "Impure", factor: half},
    {name: "Normal", factor: one},
    {name: "Pure", factor: Rational.from_float(2)},
]

class FactorySpecification {
    constructor() {
        // Game data definitions
        this.items = null
        this.recipes = null
        this.buildings = null
        this.belts = null

        this.buildTargets = []

        // Map resource recipe to {miner, purity}
        this.minerSettings = new Map()

        this.belt = null

        this.format = new Formatter()
    }
    setData(items, recipes, buildings, belts) {
        this.items = items
        this.recipes = recipes
        this.buildings = new Map()
        for (let building of buildings) {
            let category = this.buildings.get(building.category)
            if (category === undefined) {
                category = []
                this.buildings.set(building.category, category)
            }
            category.push(building)
        }
        this.belts = belts
        this.belt = belts.get("belt1")
        for (let [recipeKey, recipe] of recipes) {
            if (minerCategories.has(recipe.category)) {
                let miners = this.buildings.get(recipe.category)
                // Default to miner mk2.
                let miner = miners[miners.length - 1]
                let purity = resourcePurities[1]
                this.minerSettings.set(recipe, {miner, purity})
            }
        }
    }
    getBuilding(recipe) {
        if (this.minerSettings.has(recipe)) {
            return this.minerSettings.get(recipe).miner
        } else {
            // NOTE: Only miners offer alternative buildings. May need to
            // revisit this if higher tiers of constructors are added.
            return this.buildings.get(recipe.category)[0]
        }
    }
    getResourcePurity(recipe) {
        return this.minerSettings.get(recipe).purity
    }
    getCount(recipe, rate) {
        let building = this.getBuilding(recipe)
        return building.getCount(this, recipe, rate)
    }
    getBeltCount(rate) {
        return rate.div(this.belt.rate)
    }
    addTarget(itemKey) {
        if (itemKey === undefined) {
            itemKey = DEFAULT_ITEM_KEY
        }
        let item = this.items.get(itemKey)
        let target = new BuildTarget(this.buildTargets.length, itemKey, item, this.items)
        this.buildTargets.push(target)
        d3.select("#targets").insert(() => target.element, "#plusButton")
        return target
    }
    removeTarget(target) {
        this.buildTargets.splice(target.index, 1)
        for (let i=target.index; i < this.buildTargets.length; i++) {
            this.buildTargets[i].index--
        }
        d3.select(target.element).remove()
    }
    solve() {
        let totals = new Totals()
        for (let target of this.buildTargets) {
            let subtotals = target.item.produce(target.getRate())
            totals.combine(subtotals)
        }
        return totals
    }
    updateSolution() {
        let totals = this.solve()
        displayItems(this, totals)
        renderTotals(totals, this.buildTargets)

        window.location.hash = "#" + formatSettings()
    }
}

export let spec = new FactorySpecification()
