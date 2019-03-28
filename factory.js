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
import { formatSettings } from "./fragment.js"
import { BuildTarget } from "./target.js"
import { Totals } from "./totals.js"
import { renderTotals } from "./visualize.js"

const DEFAULT_ITEM_KEY = "supercomputer"

class FactorySpecification {
    constructor() {
        // Game data definitions
        this.items = null
        this.recipes = null
        this.buildings = null

        this.buildTargets = []
    }
    setData(items, recipes, buildings) {
        this.items = items
        this.recipes = recipes
        this.buildings = buildings
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
        renderTotals(totals, this.buildTargets)

        window.location.hash = "#" + formatSettings()
    }
}

export let spec = new FactorySpecification()
