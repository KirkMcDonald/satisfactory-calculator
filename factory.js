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
import { PriorityList } from "./priority.js"
import { Rational, zero, half, one } from "./rational.js"
import { DISABLED_RECIPE_PREFIX } from "./recipe.js"
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

        this.priority = null
        this.defaultPriority = null

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
        this.defaultPriority = this.getDefaultPriorityArray()
        this.priority = null
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
        let candidates = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            if (!this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.add(recipe)
        for (let item of candidates) {
            if (this.isItemDisabled(item)) {
                let resource = this.priority.getResource(item.disableRecipe)
                // The item might already be in the priority list due to being
                // ignored. In this case, do nothing.
                if (resource === null) {
                    let level = this.priority.getLastLevel()
                    let makeNew = true
                    for (let r of level) {
                        if (r.recipe.isDisable()) {
                            makeNew = false
                            break
                        }
                    }
                    if (makeNew) {
                        level = this.priority.addPriorityBefore(null)
                    }
                    let hundred = Rational.from_float(100)
                    this.priority.addRecipe(item.disableRecipe, hundred, level)
                }
            }
        }
    }
    setEnable(recipe) {
        // Enabling this recipe could potentially remove these items'
        // disableRecipe from the priority list. The item is only removed if it
        // goes from being disabled to not disabled, and is not ignored.
        //
        // Note that enabling a recipe for an item does not inherently mean the
        // item is not considered "disabled" in this sense. For example, if the
        // enabled recipe is net-negative in its use of the item.
        let candidates = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            if (this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.delete(recipe)
        for (let item of candidates) {
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
            }
        }
    }
    getDefaultPriorityArray() {
        let a = []
        for (let [recipeKey, recipe] of this.recipes) {
            if (recipe.isResource()) {
                let pri = recipe.defaultPriority
                while (a.length < pri + 1) {
                    a.push(new Map())
                }
                a[pri].set(recipe, recipe.defaultWeight)
            }
        }
        return a
    }
    setDefaultPriority() {
        this.priority = PriorityList.fromArray(this.defaultPriority)
    }
    setPriorities(tiers) {
        let a = []
        for (let tier of tiers) {
            let m = new Map()
            for (let [recipeKey, weight] of tier) {
                let recipe = this.recipes.get(recipeKey)
                if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
                    let itemKey = recipeKey.slice(DISABLED_RECIPE_PREFIX.length)
                    recipe = this.items.get(itemKey).disableRecipe
                }
                m.set(recipe, weight)
            }
            a.push(m)
        }
        this.priority.applyArray(a)
    }
    isDefaultPriority() {
        return this.priority.equalArray(this.defaultPriority)
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
    // Returns whether the current item requires the use of its DisabledRecipe
    // as a consequence of its recipes being disabled. (It may still require it
    // as a consequence of the item being ignored, independent of this.)
    //
    // It's worth mentioning that this is insufficent to guarantee that no
    // infeasible solutions exist. Catching net-negative single recipes ought
    // to account for the most common cases, but net-negative recipe loops are
    // still possible.
    isItemDisabled(item) {
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                let net = recipe.netGives(item)
                if (net && zero.less(net)) {
                    return false
                }
            }
        }
        return true
    }
    getRecipes(item) {
        let recipes = []
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        // The disableRecipe's purpose is to provide an item ex nihilo, in
        // cases where solutions are infeasible otherwise. This happens in two
        // cases: When enough recipes have been disabled to prevent its
        // production in any other way, and when the item is being ignored.
        if (this.isItemDisabled(item) || this.ignore.has(item)) {
            let result = [item.disableRecipe]
            // Still consider any recipes which produce both this item and any
            // other un-ignored items.
            for (let r of recipes) {
                for (let ing of r.products) {
                    if (!this.ignore.has(ing.item)) {
                        result.push(r)
                        break
                    }
                }
            }
            return result
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
        if (this.minerSettings.has(recipe)) {
            return this.minerSettings.get(recipe).purity
        } else {
            return resourcePurities[1]
        }
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
    toggleIgnore(item) {
        if (this.ignore.has(item)) {
            this.ignore.delete(item)
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
            }
        } else {
            this.ignore.add(item)
            if (!this.isItemDisabled(item)) {
                let level = this.priority.getFirstLevel()
                let makeNew = true
                for (let r of level) {
                    if (r.recipe.isDisable()) {
                        makeNew = false
                        break
                    }
                }
                if (makeNew) {
                    level = this.priority.addPriorityBefore(level)
                }
                let hundred = Rational.from_float(100)
                this.priority.addRecipe(item.disableRecipe, hundred, level)
            }
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

        //renderDebug()
    }
}

export let spec = new FactorySpecification()
window.spec = spec
