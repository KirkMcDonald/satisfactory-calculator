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
import { Formatter } from "./align.js"
import { renderDebug } from "./debug.js"
import { displayItems } from "./display.js"
import { formatSettings } from "./fragment.js"
import { Rational, zero, half, one } from "./rational.js"
import { DisabledRecipe } from "./recipe.js"
import { solve } from "./solve.js"
import { BuildTarget } from "./target.js"
import { renderTotals } from "./visualize.js"

const DEFAULT_ITEM_KEY = "supercomputer"

let minerCategories = new Set(["mineral", "oil"])

export let resourcePurities = [
    {key: "0", name: "Impure", factor: half},
    {key: "1", name: "Normal", factor: one},
    {key: "2", name: "Pure", factor: Rational.from_float(2)},
]

export let DEFAULT_PURITY = resourcePurities[1]

export let DEFAULT_BELT = "belt1"

// higher in list == harder to acquire
// Broadly speaking, corresponds to tech tree.
// Much of this order is arbitrary; don't read too much into it.
// This strictly relates to acquisition as a resource directly from the world.
// If an item can be acquired from crafting via lower-priority items, then the
// solution will prefer the craft over harvesting the resource.
const DEFAULT_PRIORITY = [
    ["Iron Ore", "Copper Ore", "Limestone"],
    ["Coal", "Water"],
    ["Caterium Ore", "Sulfur", "Raw Quartz"],
    ["Crude Oil"],
    ["Bauxite"],
    ["Uranium"],
]

class PriorityLevel {
    constructor() {
        this.recipes = new Set()
    }
    getRecipeArray() {
        return Array.from(this.recipes)
    }
    add(recipe) {
        this.recipes.add(recipe)
    }
    remove(recipe) {
        this.recipes.delete(recipe)
    }
    has(recipe) {
        return this.recipes.has(recipe)
    }
    isEmpty() {
        return this.recipes.size == 0
    }
}

class FactorySpecification {
    constructor() {
        // Game data definitions
        this.items = null
        this.recipes = null
        this.buildings = null
        this.belts = null

        this.itemTiers = []

        this.buildTargets = []

        // Map resource recipe to {miner, purity}
        this.miners = new Map()
        this.minerSettings = new Map()

        // Map recipe to overclock factor
        this.overclock = new Map()

        this.belt = null

        this.ignore = new Set()
        this.disable = new Set()
        this.defaultDisable = new Set()

        this.priority = []

        this.format = new Formatter()

        this.lastPartial = null
        this.lastTableau = null
        this.lastMetadata = null
        this.lastSolution = null
    }
    setData(items, recipes, buildings, belts) {
        this.items = items
        let tierMap = new Map()
        this.defaultDisable = new Set()
        for (let [itemKey, item] of items) {
            let tier = tierMap.get(item.tier)
            if (tier === undefined) {
                tier = []
                tierMap.set(item.tier, tier)
            }
            tier.push(item)
            // By default, disable all recipes but one for (most) items that
            // have multiple recipes.
            if (item.recipes.length > 1) {
                let chosen = null
                let skip = false
                for (let recipe of item.recipes) {
                    if (recipe.isResource()) {
                        chosen = recipe
                    }
                    // If any of this item's recipes produce multiple items,
                    // then don't disable any of these recipes, and let the
                    // linear program sort it out.
                    if (recipe.products.length > 1) {
                        skip = true
                    }
                }
                if (skip) {
                    continue
                }
                if (chosen === null) {
                    chosen = item.recipes[0]
                }
                for (let recipe of item.recipes) {
                    if (recipe !== chosen) {
                        this.defaultDisable.add(recipe)
                    }
                }
            }
        }
        this.itemTiers = []
        for (let [tier, tierItems] of tierMap) {
            this.itemTiers.push(tierItems)
        }
        this.itemTiers.sort((a, b) => a[0].tier - b[0].tier)
        this.recipes = recipes
        this.resourceNameMap = new Map()
        for (let [key, recipe] of recipes) {
            if (recipe.isResource()) {
                this.resourceNameMap.set(recipe.name, recipe)
            }
        }
        this.buildings = new Map()
        for (let building of buildings) {
            let category = this.buildings.get(building.category)
            if (category === undefined) {
                category = []
                this.buildings.set(building.category, category)
            }
            category.push(building)
            if (minerCategories.has(building.category)) {
                this.miners.set(building.key, building)
            }
        }
        this.belts = belts
        this.belt = belts.get(DEFAULT_BELT)
        this.initMinerSettings()
    }
    setDefaultDisable() {
        this.disable.clear()
        for (let recipe of this.defaultDisable) {
            this.disable.add(recipe)
        }
    }
    isDefaultDisable() {
        if (this.disable.size !== this.defaultDisable.size) {
            return false
        }
        for (let recipe of this.disable) {
            if (!this.defaultDisable.has(recipe)) {
                return false
            }
        }
        return true
    }
    setDisable(recipe) {
        this.disable.add(recipe)
    }
    setEnable(recipe) {
        this.disable.delete(recipe)
    }
    setDefaultPriority() {
        let tiers = []
        for (let tierNames of DEFAULT_PRIORITY) {
            let tier = []
            for (let name of tierNames) {
                tier.push(this.resourceNameMap.get(name).key)
            }
            tiers.push(tier)
        }
        this.setPriorities(tiers)
    }
    setPriorities(tiers) {
        this.priority = []
        for (let tier of tiers) {
            let tierList = new PriorityLevel()
            for (let key of tier) {
                let recipe = this.recipes.get(key)
                if (!recipe) {
                    throw new Error("bad resource key: " + key)
                }
                tierList.add(recipe)
            }
            this.priority.push(tierList)
        }
    }
    isDefaultPriority() {
        if (this.priority.length !== DEFAULT_PRIORITY.length) {
            return false
        }
        for (let i = 0; i < this.priority.length; i++) {
            let pri = this.priority[i]
            let def = DEFAULT_PRIORITY[i]
            if (pri.recipes.size !== def.length) {
                return false
            }
            for (let name of def) {
                if (!pri.has(this.resourceNameMap.get(name))) {
                    return false
                }
            }
        }
        return true
    }
    // Moves recipe to the given priority level. If the recipe's old
    // priority is empty as a result, removes it and returns true. Returns
    // false otherwise.
    setPriority(recipe, priority) {
        let oldPriority = null
        let i = 0
        for (; i < this.priority.length; i++) {
            let p = this.priority[i]
            if (p.has(recipe)) {
                oldPriority = p
                break
            }
        }
        oldPriority.remove(recipe)
        priority.add(recipe)
        if (oldPriority.isEmpty()) {
            this.priority.splice(i, 1)
            return true
        }
        return false
    }
    // Creates a new priority level immediately preceding the given one.
    // If the given priority is null, adds the new priority to the end of
    // the priority list.
    //
    // Returns the new PriorityLevel.
    addPriorityBefore(priority) {
        let newPriority = new PriorityLevel()
        if (priority === null) {
            this.priority.push(newPriority)
        } else {
            for (let i = 0; i < this.priority.length; i++) {
                if (this.priority[i] === priority) {
                    this.priority.splice(i, 0, newPriority)
                    break
                }
            }
        }
        return newPriority
    }
    initMinerSettings() {
        this.minerSettings = new Map()
        for (let [recipeKey, recipe] of this.recipes) {
            if (minerCategories.has(recipe.category)) {
                let miners = this.buildings.get(recipe.category)
                // Default to miner mk1.
                let miner = miners[0]
                // Default to normal purity.
                let purity = DEFAULT_PURITY
                this.minerSettings.set(recipe, {miner, purity})
            }
        }
    }
    getUses(item) {
        let recipes = []
        for (let recipe of item.uses) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        return recipes
    }
    getRecipes(item) {
        let recipes = []
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        // The logic here is complicated, but has to do with which recipes we
        // want to be present in the solution, related to ignored items.
        if (recipes.length === 0) {
            let recipe = item.disableRecipe
            if (recipe === null) {
                recipe = new DisabledRecipe(item, true)
                item.disableRecipe = recipe
            }
            return [recipe]
        }
        if (this.ignore.has(item)) {
            let recipe = item.ignoreRecipe
            if (recipe === null) {
                recipe = new DisabledRecipe(item, false)
                item.ignoreRecipe = recipe
            }
            if (recipes.length !== 1 || recipes[0].products.length !== 1) {
                return [recipe, ...recipes]
            }
            return [recipe]
        }
        return recipes
    }
    _getItemGraph(item, recipes) {
        for (let recipe of this.getRecipes(item)) {
            if (recipes.has(recipe)) {
                continue
            }
            recipes.add(recipe)
            for (let ing of recipe.ingredients) {
                this._getItemGraph(ing.item, recipes)
            }
        }
    }
    // Returns the set of recipes which may contribute to the production of
    // the given collection of items.
    getRecipeGraph(items) {
        let graph = new Set()
        for (let [item, rate] of items) {
            this._getItemGraph(item, graph)
        }
        return graph
    }
    getRecipe(item) {
        return item.recipes[0]
    }
    getBuilding(recipe) {
        if (recipe.category === null) {
            return null
        } else if (this.minerSettings.has(recipe)) {
            return this.minerSettings.get(recipe).miner
        } else {
            // NOTE: Only miners offer alternative buildings. May need to
            // revisit this if higher tiers of constructors are added.
            return this.buildings.get(recipe.category)[0]
        }
    }
    getOverclock(recipe) {
        return this.overclock.get(recipe) || one
    }
    setOverclock(recipe, overclock) {
        if (overclock.equal(one)) {
            this.overclock.delete(recipe)
        } else {
            this.overclock.set(recipe, overclock)
        }
    }
    // Returns the recipe-rate at which a single building can produce a recipe.
    // Returns null for recipes that do not have a building.
    getRecipeRate(recipe) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return null
        }
        return building.getRecipeRate(this, recipe)
    }
    getResourcePurity(recipe) {
        // XXX: water extractors, blah
        //return this.minerSettings.get(recipe).purity
        return resourcePurities[1]
    }
    setMiner(recipe, miner, purity) {
        this.minerSettings.set(recipe, {miner, purity})
    }
    getCount(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return zero
        }
        return building.getCount(this, recipe, rate)
    }
    getBeltCount(rate) {
        return rate.div(this.belt.rate)
    }
    getPowerUsage(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return {average: zero, peak: zero}
        }
        let count = this.getCount(recipe, rate)
        let average = building.power.mul(count)
        let peak = building.power.mul(count.ceil())
        let overclock = this.overclock.get(recipe)
        if (overclock !== undefined) {
            // The result of this exponent will typically be irrational, so
            // this approximation is a necessity. Because overclock is limited
            // to the range [1.0, 2.5], any imprecision introduced by this
            // approximation is minimal (and is probably less than is present
            // in the game itself).
            let overclockFactor = Rational.from_float(Math.pow(overclock.toFloat(), 1.6))
            average = average.mul(overclockFactor)
            peak = peak.mul(overclockFactor)
        }
        return {average, peak}
    }
    addTarget(itemKey) {
        if (itemKey === undefined) {
            itemKey = DEFAULT_ITEM_KEY
        }
        let item = this.items.get(itemKey)
        let target = new BuildTarget(this.buildTargets.length, itemKey, item, this.itemTiers)
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
    toggleIgnore(recipe) {
        if (this.ignore.has(recipe)) {
            this.ignore.delete(recipe)
        } else {
            this.ignore.add(recipe)
        }
    }
    solve() {
        let outputs = new Map()
        for (let target of this.buildTargets) {
            let rate = target.getRate()
            rate = rate.add(outputs.get(target.item) || zero)
            outputs.set(target.item, rate)
        }
        let totals = solve(this, outputs)
        return totals
    }
    setHash() {
        window.location.hash = "#" + formatSettings()
    }
    updateSolution() {
        let totals = this.solve()
        displayItems(this, totals)
        renderTotals(totals, this.ignore)
        this.setHash()

        renderDebug()
    }
}

export let spec = new FactorySpecification()
window.spec = spec
