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
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, longRateNames } from "./align.js"
import { dropdown } from "./dropdown.js"
import { DEFAULT_TAB, clickTab } from "./events.js"
import { spec, resourcePurities, DEFAULT_BELT } from "./factory.js"
import { getRecipeGroups } from "./groups.js"
import { Rational } from "./rational.js"

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// tab

function renderTab(settings) {
    let tabName = DEFAULT_TAB
    if (settings.has("tab")) {
        tabName = settings.get("tab")
    }
    clickTab(tabName)
}

// build targets

function renderTargets(settings) {
    spec.buildTargets = []
    d3.select("#targets li.target").remove()

    let targetSetting = settings.get("items")
    if (targetSetting !== undefined && targetSetting !== "") {
        let targets = targetSetting.split(",")
        for (let targetString of targets) {
            let parts = targetString.split(":")
            let itemKey = parts[0]
            let target = spec.addTarget(itemKey)
            let type = parts[1]
            if (type === "f") {
                target.setBuildings(parts[2])
            } else if (type === "r") {
                target.setRate(parts[2])
            } else {
                throw new Error("unknown target type")
            }
        }
    } else {
        spec.addTarget()
    }
}

// ignore

function renderIgnore(settings) {
    spec.ignore.clear()
    // UI will be rendered later, as part of the solution.
    let ignoreSetting = settings.get("ignore")
    if (ignoreSetting !== undefined && ignoreSetting !== "") {
        let ignore = ignoreSetting.split(",")
        for (let itemKey of ignore) {
            let item = spec.items.get(itemKey)
            spec.ignore.add(item)
        }
    }
}

// overclock

function renderOverclock(settings) {
    spec.overclock.clear()
    // UI will be rendered later, as part of the solution.
    let overclockSetting = settings.get("overclock")
    if (overclockSetting !== undefined && overclockSetting !== "") {
        let overclock = overclockSetting.split(",")
        for (let pair of overclock) {
            let [recipeKey, percentString] = pair.split(":")
            let recipe = spec.recipes.get(recipeKey)
            let percent = Rational.from_string(percentString).div(Rational.from_float(100))
            spec.setOverclock(recipe, percent)
        }
    }
}

// display rate

function rateHandler() {
    spec.format.setDisplayRate(this.value)
    spec.updateSolution()
}

function renderRateOptions(settings) {
    let rateName = DEFAULT_RATE
    if (settings.has("rate")) {
        rateName = settings.get("rate")
    }
    spec.format.setDisplayRate(rateName)
    let rates = []
    for (let [rateName, longRateName] of longRateNames) {
        rates.push({rateName, longRateName})
    }
    let form = d3.select("#display_rate")
    form.selectAll("*").remove()
    let rateOption = form.selectAll("span")
        .data(rates)
        .join("span")
    rateOption.append("input")
        .attr("id", d => d.rateName + "_rate")
        .attr("type", "radio")
        .attr("name", "rate")
        .attr("value", d => d.rateName)
        .attr("checked", d => d.rateName === rateName ? "" : null)
        .on("change", rateHandler)
    rateOption.append("label")
        .attr("for", d => d.rateName + "_rate")
        .text(d => "items/" + d.longRateName)
    rateOption.append("br")
}

// precisions

function renderPrecisions(settings) {
    spec.format.ratePrecision = DEFAULT_RATE_PRECISION
    if (settings.has("rp")) {
        spec.format.ratePrecision = Number(settings.get("rp"))
    }
    d3.select("#rprec").attr("value", spec.format.ratePrecision)
    spec.format.countPrecision = DEFAULT_COUNT_PRECISION
    if (settings.has("cp")) {
        spec.format.countPrecision = Number(settings.get("cp"))
    }
    d3.select("#cprec").attr("value", spec.format.countPrecision)
}

// belt

function beltHandler(event, belt) {
    spec.belt = belt
    spec.updateSolution()
}

function renderBelts(settings) {
    let beltKey = DEFAULT_BELT
    if (settings.has("belt")) {
        beltKey = settings.get("belt")
    }
    spec.belt = spec.belts.get(beltKey)

    let belts = []
    for (let [beltKey, belt] of spec.belts) {
        belts.push(belt)
    }
    let form = d3.select("#belt_selector")
    form.selectAll("*").remove()
    let beltOption = form.selectAll("span")
        .data(belts)
        .join("span")
    beltOption.append("input")
        .attr("id", d => "belt." + d.key)
        .attr("type", "radio")
        .attr("name", "belt")
        .attr("value", d => d.key)
        .attr("checked", d => d === spec.belt ? "" : null)
        .on("change", beltHandler)
    beltOption.append("label")
        .attr("for", d => "belt." + d.key)
        .append(d => d.icon.make(32))
}

// recipe disabling

function renderIngredient(ingSpan) {
    ingSpan.classed("ingredient", true)
        .attr("title", d => d.item.name)
        .append(d => d.item.icon.make(32))
    ingSpan.append("span")
        .classed("count", true)
        .text(d => spec.format.count(d.amount))
}

function renderRecipes(settings) {
    if (settings.has("disable")) {
        let keys = settings.get("disable").split(",")
        for (let k of keys) {
            let recipe = spec.recipes.get(k)
            if (recipe) {
                spec.setDisable(recipe)
            }
        }
    } else {
        spec.setDefaultDisable()
    }

    let allGroups = getRecipeGroups(new Set(spec.recipes.values()))
    let groups = []
    for (let group of allGroups) {
        if (group.size > 1) {
            groups.push(Array.from(group))
        }
    }

    let div = d3.select("#recipe_toggles")
    div.selectAll("*").remove()
    let recipe = div.selectAll("div")
        .data(groups)
        .join("div")
            .classed("toggle-row", true)
            .selectAll("div")
            .data(d => d)
            .join("div")
                .classed("toggle", true)
                .classed("selected", d => !spec.disable.has(d))
                .attr("title", d => d.name)
                .on("click", function(event, d) {
                    let disabled = spec.disable.has(d)
                    d3.select(this).classed("selected", disabled)
                    if (disabled) {
                        spec.setEnable(d)
                    } else {
                        spec.setDisable(d)
                    }
                    spec.updateSolution()
                })
    recipe.append("span")
        .classed("title", true)
        .text(d => d.name)
    recipe.append("br")
    let productSpan = recipe.append("span")
        .selectAll("span")
        .data(d => d.products)
        .join("span")
    renderIngredient(productSpan)
    recipe.append("span")
        .classed("arrow", true)
        .text("\u21d0")
    let ingredientSpan = recipe.append("span")
        .selectAll("span")
        .data(d => d.ingredients)
        .join("span")
    renderIngredient(ingredientSpan)
}

// miners

function mineHandler(d) {
    spec.setMiner(d.recipe, d.miner, d.purity)
    spec.updateSolution()
}

function renderResources(settings) {
    spec.initMinerSettings()
    if (settings.has("miners")) {
        let miners = settings.get("miners").split(",")
        for (let minerString of miners) {
            let [recipeKey, minerKey, purityKey] = minerString.split(":")
            let recipe = spec.recipes.get(recipeKey)
            let miner = spec.miners.get(minerKey)
            let purity = resourcePurities[Number(purityKey)]
            spec.setMiner(recipe, miner, purity)
        }
    }

    let div = d3.select("#miner_settings")
    div.selectAll("*").remove()
    let resources = []
    for (let [recipe, {miner, purity}] of spec.minerSettings) {
        let minerDefs = spec.buildings.get(recipe.category)
        let purities = []
        for (let purityDef of resourcePurities) {
            let miners = []
            for (let minerDef of spec.buildings.get(recipe.category)) {
                let selected = miner === minerDef && purity === purityDef
                miners.push({
                    recipe: recipe,
                    purity: purityDef,
                    miner: minerDef,
                    selected: selected,
                    id: `miner.${recipe.key}.${purityDef.key}.${minerDef.key}`
                })
            }
            purities.push({miners, purityDef})
        }
        resources.push({recipe, purities, minerDefs})
    }
    let resourceTable = div.selectAll("table")
        .data(resources)
        .join("table")
            .classed("resource", true)
    let header = resourceTable.append("tr")
    header.append("th")
        .append(d => d.recipe.icon.make(32))
    header.selectAll("th")
        .filter((d, i) => i > 0)
        .data(d => d.minerDefs)
        .join("th")
            .append(d => d.icon.make(32))
    let purityRow = resourceTable.selectAll("tr")
        .filter((d, i) => i > 0)
        .data(d => d.purities)
        .join("tr")
    purityRow.append("td")
        .text(d => d.purityDef.name)
    let cell = purityRow.selectAll("td")
        .filter((d, i) => i > 0)
        .data(d => d.miners)
        .join("td")
    cell.append("input")
        .attr("id", d => d.id)
        .attr("type", "radio")
        .attr("name", d => d.recipe.key)
        .attr("checked", d => d.selected ? "" : null)
        .on("change", mineHandler)
    cell.append("label")
        .attr("for", d => d.id)
        .append("svg")
            .attr("viewBox", "0,0,32,32")
            .style("width", 32)
            .style("height", 32)
            .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 32)
                .attr("height", 32)
                .attr("rx", 4)
                .attr("ry", 4)
}

// resource priority

function renderResourcePriorities(settings) {
    if (settings.has("priority")) {
        let tiers = []
        let keys = settings.get("priority").split(";")
        for (let s of keys) {
            tiers.push(s.split(","))
        }
        spec.setPriorities(tiers)
    } else {
        spec.setDefaultPriority()
    }
    let dragitem = null
    let dragElement = null

    let div = d3.select("#resource_settings")
    div.selectAll("*").remove()

    function dropTargetBoilerplate(s, drop) {
        s.on("dragover", function(event, d) {
            event.preventDefault()
        })
        s.on("dragenter", function(event, d) {
            this.classList.add("highlight")
        })
        s.on("dragleave", function(event, d) {
            if (event.target === this) {
                this.classList.remove("highlight")
            }
        })
        s.on("drop", function(event, d) {
            if (dragitem === null) {
                return
            }
            event.preventDefault()
            this.classList.remove("highlight")
            drop.call(this, event, d)
            dragitem = null
            dragElement = null
            spec.updateSolution()
        })
    }

    function removeTier(tier) {
        let oldMiddle = tier.previousSibling
        if (oldMiddle.classList.contains("middle")) {
            d3.select(oldMiddle).remove()
        } else {
            d3.select(tier.nextSibling).remove()
        }
        d3.select(tier).remove()
    }

    function makeTier(p) {
        let tier = d3.create("div")
            .datum(p)
            .classed("resource-tier", true)
        dropTargetBoilerplate(tier, function(event, d) {
            if (dragElement.parentNode !== this) {
                let remove = spec.setPriority(dragitem, d)
                let oldTier = dragElement.parentNode
                this.appendChild(dragElement)
                if (remove) {
                    removeTier(oldTier)
                }
            }
        })
        let resource = tier.selectAll("div")
            .data(d => d.getRecipeArray())
            .join("div")
        resource.classed("resource", true)
            //.attr("draggable", "true")
            .on("dragstart", function(event, d) {
                div.classed("dragging", true)
                dragitem = d
                dragElement = this
            })
            .on("dragend", function(event, d) {
                div.classed("dragging", false)
            })
        resource.append(d => d.icon.make(48))
        return tier.node()
    }

    function makeMiddle(p) {
        let middle = d3.create("div")
            .datum(p)
            .classed("middle", true)
        dropTargetBoilerplate(middle, function(event, d) {
            let p = spec.addPriorityBefore(d)
            let oldTier = dragElement.parentNode
            div.node().insertBefore(makeMiddle(p), this)
            let newTier = makeTier(p)
            div.node().insertBefore(newTier, this)
            let remove = spec.setPriority(dragitem, p)
            newTier.appendChild(dragElement)
            if (remove) {
                removeTier(oldTier)
            }
        })
        return middle.node()
    }

    let less = div.append("div")
        .classed("resource-tier bookend", true)
    dropTargetBoilerplate(less, function(event, d) {
        let first = spec.priority[0]
        let firstTier = this.nextSibling
        let p = spec.addPriorityBefore(first)
        let oldTier = dragElement.parentNode
        let newTier = makeTier(p)
        div.node().insertBefore(newTier, firstTier)
        div.node().insertBefore(makeMiddle(first), firstTier)
        let remove = spec.setPriority(dragitem, p)
        newTier.appendChild(dragElement)
        if (remove) {
            removeTier(oldTier)
        }
    })
    less.append("span")
        .text("less valuable")
    let first = true
    for (let p of spec.priority) {
        if (!first) {
            div.append(() => makeMiddle(p))
        }
        first = false
        div.append(() => makeTier(p))
    }
    let more = div.append("div")
        .classed("resource-tier bookend", true)
    dropTargetBoilerplate(more, function(event, d) {
        let p = spec.addPriorityBefore(null)
        let oldTier = dragElement.parentNode
        div.node().insertBefore(makeMiddle(p), this)
        let newTier = makeTier(p)
        div.node().insertBefore(newTier, this)
        let remove = spec.setPriority(dragitem, p)
        newTier.appendChild(dragElement)
        if (remove) {
            removeTier(oldTier)
        }
    })
    more.append("span")
        .text("more valuable")
}

export function renderSettings(settings) {
    renderTargets(settings)
    renderIgnore(settings)
    renderOverclock(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderBelts(settings)
    renderRecipes(settings)
    renderResources(settings)
    renderResourcePriorities(settings)
    renderTab(settings)
}
