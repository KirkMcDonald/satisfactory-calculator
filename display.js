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
import { toggleIgnoreHandler } from "./events.js"
import { spec } from "./factory.js"
import { getRecipeGroups, topoSort } from "./groups.js"
import { Rational, zero, one } from "./rational.js"

class Header {
    constructor(text, colspan, surplus) {
        this.text = text
        this.colspan = colspan
        this.surplus = surplus
    }
}

function changeOverclock(event, d) {
    let hundred = Rational.from_float(100)
    let twoFifty = Rational.from_float(250)
    let x = Rational.from_string(this.value).floor()
    if (x.less(one)) {
        x = one
    }
    if (twoFifty.less(x)) {
        x = twoFifty
    }
    x = x.div(hundred)
    spec.setOverclock(d.recipe, x)
    spec.updateSolution()
}

function clickSloop(event, d) {
    event.preventDefault()
    let count = d.sloop
    let max = d.building.maxSomersloop
    if (count.equal(zero)) {
        count = max
    } else {
        count = count.sub(one)
    }
    spec.setSomersloop(d.recipe, count)
    spec.updateSolution()
}

function setlen(a, len, callback) {
    if (a.length > len) {
        a.length = len
    }
    while (a.length < len) {
        a.push(callback())
    }
}

class BreakdownRow {
    constructor(item, destRecipe, rate, building, divider) {
        this.item = item
        this.recipe = destRecipe
        this.rate = rate
        this.building = building
        this.divider = divider
    }
}

function getBreakdown(item, totals) {
    let rows = []
    let uses = []
    let found = false
    for (let recipe of item.recipes) {
        if (!totals.rates.has(recipe)) {
            continue
        }
        for (let ing of recipe.ingredients) {
            let rate = totals.consumers.get(ing.item).get(recipe)
            rows.push(new BreakdownRow(ing.item, recipe, rate, false))
            found = true
        }
    }
    for (let [recipe, rate] of totals.consumers.get(item)) {
        if (recipe.isReal()) {
            let building = spec.getBuilding(recipe)
            rows.push(new BreakdownRow(item, recipe, rate, building, found))
            found = false
        }
    }
    return rows
}

/*class DisplayRow {
    constructor() {
    }
    setData(item, recipe, single) {
    }
}*/

class DisplayGroup {
    constructor() {
        this.rows = []
    }
    setData(totals, items, recipes) {
        items = [...items]
        recipes = [...recipes]
        if (items.length === 0) {
            this.rows.length = 0
            return
        }
        let len = Math.max(items.length, recipes.length)
        setlen(this.rows, len, () => {return {}})
        let hundred = Rational.from_float(100)
        for (let i = 0; i < len; i++) {
            let item = items[i] || null
            let recipe = recipes[i] || null
            let building = null
            let overclock = null
            let sloop = null
            if (recipe !== null) {
                building = spec.getBuilding(recipe)
                overclock = spec.getOverclock(recipe).mul(hundred).toString()
                if (building !== null && building.maxSomersloop !== null) {
                    sloop = spec.somersloop.get(recipe)
                    if (sloop === undefined) {
                        sloop = zero
                    }
                }
            }
            let single = item !== null && recipe !== null && item.name === recipe.name
            let breakdown = null
            if (item !== null) {
                breakdown = getBreakdown(item, totals)
            }
            Object.assign(this.rows[i], {
                item,
                recipe,
                building,
                overclock,
                sloop,
                single,
                breakdown,
            })
        }
    }
}

// Remember these values from update to update, to make it simpler to reuse
// elements.
let displayGroups = []

function getDisplayGroups(totals) {
    let groupObjects = topoSort(getRecipeGroups(new Set(totals.rates.keys())))
    setlen(displayGroups, groupObjects.length, () => new DisplayGroup())
    let i = 0
    for (let group of groupObjects) {
        let items = new Set()
        for (let recipe of group) {
            for (let ing of recipe.products) {
                if (totals.items.has(ing.item)) {
                    items.add(ing.item)
                }
            }
        }
        displayGroups[i++].setData(totals, items, group)
    }
}

function toggleBreakdownHandler() {
    let row = this.parentNode
    let bdRow = row.nextSibling
    if (row.classList.contains("breakdown-open")) {
        row.classList.remove("breakdown-open")
        bdRow.classList.remove("breakdown-open")
    } else {
        row.classList.add("breakdown-open")
        bdRow.classList.add("breakdown-open")
    }
}

export function displayItems(spec, totals) {
    let headers = [
        new Header("", 1),
        new Header("items/" + spec.format.rateName, 2),
        new Header("surplus/" + spec.format.rateName, 1, true),
        new Header("belts", 2),
        new Header("buildings", 2),
        new Header("overclock", 1),
        new Header("somersloop", 1),
        new Header("power", 1),
    ]
    let totalCols = 0
    for (let header of headers) {
        totalCols += header.colspan
    }

    let table = d3.select("table#totals")
        table.classed("nosurplus", totals.surplus.size === 0)

    let headerRow = table.selectAll("thead tr").selectAll("th")
        .data(headers)
    headerRow.exit().remove()
    headerRow.join("th")
        .classed("surplus", d => d.surplus)
        .text(d => d.text)
        .attr("colspan", d => d.colspan)

    getDisplayGroups(totals)
    let rowGroup = table.selectAll("tbody")
        .data(displayGroups)
        .join("tbody")
    rowGroup.selectAll("tr.breakdown").remove()
    // Create new rows.
    let row = rowGroup.selectAll("tr")
        .data(d => d.rows)
        .join(enter => {
            let row = enter.append("tr")
            // cell 1: breakdown toggle
            row.append("td")
                .classed("item", true)
                .on("click", toggleBreakdownHandler)
                .append("svg")
                    .classed("breakdown-arrow", true)
                    .attr("viewBox", "0 0 16 16")
                    .attr("width", 16)
                    .attr("height", 16)
                    .append("use")
                        .attr("href", "images/icons.svg#right")
            // cell 2: item icon
            row.append("td")
                .classed("item", true)
                .append("img")
                    .classed("icon item-icon", true)
                    .attr("width", 32)
                    .attr("height", 32)
                    .on("click", toggleIgnoreHandler)
            // cell 3: item rate
            row.append("td")
                .classed("item right-align", true)
                .append("tt")
                    .classed("item-rate", true)
            // cell 4: surplus rate
            row.append("td")
                .classed("item surplus right-align", true)
                .append("tt")
                    .classed("surplus-rate", true)
            // cell 5: belt icon
            let beltCell = row.append("td")
                .classed("item pad", true)
            beltCell.append("img")
                .classed("icon belt-icon", true)
                .attr("width", 32)
                .attr("height", 32)
            beltCell.append("span")
                .text(" \u00d7")
            // cell 6: belt count
            row.append("td")
                .classed("item right-align", true)
                .append("tt")
                    .classed("belt-count", true)

            // cell 7: building icon
            let buildingCell = row.append("td")
                .classed("pad building building-icon right-align", true)
            // cell 8: building count
            row.append("td")
                .classed("right-align building", true)
                .append("tt")
                    .classed("building-count", true)

            // cell 9: overclock
            let overclockCell = row.append("td")
                .classed("pad building", true)
            overclockCell.append("input")
                .classed("overclock", true)
                .attr("type", "number")
                .attr("title", "")
                .attr("min", 1)
                .attr("max", 250)
                .on("input", changeOverclock)
            overclockCell.append("span")
                .text("%")

            // cell 10: somersloop
            let sloopCell = row.append("td")
                .classed("pad building sloopcell", true)
                .append("div")
                    .classed("sloop", true)
            sloopCell.append("img")
                .attr("src", "images/Somersloop.png")
                .attr("width", 32)
                .attr("height", 32)
            sloopCell.append("div")
                .classed("meter", true)
            sloopCell.append("div")
                .classed("count", true)
            sloopCell.append("div")
                .classed("sloopclick", true)
                .on("click", clickSloop)

            // cell 11: power
            row.append("td")
                .classed("right-align pad building", true)
                .append("tt")
                    .classed("power", true)

            return row
        })
        .classed("nobuilding", d => d.building === null)
        .classed("noitem", d => d.item === null)
    // Update row data.
    let itemRow = row.filter(d => d.item !== null)
    itemRow.selectAll("img.item-icon")
        .classed("ignore", d => spec.ignore.has(d.item))
        .attr("src", d => d.item.icon.path())
        .attr("title", d => d.item.name)
    itemRow.selectAll("tt.item-rate")
        .text(d => {
            let rate = totals.items.get(d.item)
            if (totals.surplus.has(d.item)) {
                rate = rate.sub(totals.surplus.get(d.item))
            }
            return spec.format.alignRate(rate)
        })
    itemRow.selectAll("tt.surplus-rate")
        .text(d => spec.format.alignRate(totals.surplus.has(d.item) ? totals.surplus.get(d.item) : zero))
    let beltRow = itemRow.filter(d => d.item.phase === "solid")
    beltRow.selectAll("img.belt-icon")
        .attr("src", spec.belt.icon.path())
        .attr("title", spec.belt.name)
    beltRow.selectAll("tt.belt-count")
        .text(d => spec.format.alignCount(spec.getBeltCount(totals.items.get(d.item))))
    let pipeRow = itemRow.filter(d => d.item.phase === "fluid")
    pipeRow.selectAll("img.belt-icon")
        .attr("src", spec.pipe.icon.path())
        .attr("title", spec.pipe.name)
    pipeRow.selectAll("tt.belt-count")
        .text(d => spec.format.alignCount(spec.getPipeCount(totals.items.get(d.item))))
    let buildingRow = row.filter(d => d.building !== null)
        .classed("nosloop", d => d.sloop === null)
    let buildingCell = buildingRow.selectAll("td.building-icon")
    buildingCell.selectAll("*").remove()
    let buildingExtra = buildingCell.filter(d => !d.single)
    buildingExtra.append(d => d.recipe.icon.make(32))
    buildingExtra.append("span")
        .text(":")
    buildingCell.append(d => d.building.icon.make(32))
    buildingCell.append("span")
        .text(" \u00d7")
    buildingRow.selectAll("tt.building-count")
        .text(d => spec.format.alignCount(spec.getCount(d.recipe, totals.rates.get(d.recipe))))
    buildingRow.selectAll("input.overclock")
        .attr("value", d => d.overclock)
    let hundred = Rational.from_float(100)
    let sloopRow = buildingRow.filter(d => d.sloop !== null)
    sloopRow.selectAll(".meter")
        .style("height", d => {
            return one.sub(d.sloop.div(d.building.maxSomersloop)).mul(hundred).floor().toString() + "%"
        })
    sloopRow.selectAll(".count")
        .text(d => `${d.sloop.toString()}/${d.building.maxSomersloop.toString()}`)
    let totalAveragePower = zero
    let totalPeakPower = zero
    buildingRow.selectAll("tt.power")
        .text(d => {
            let rate = totals.rates.get(d.recipe)
            let {average, peak} = spec.getPowerUsage(d.recipe, rate)
            totalAveragePower = totalAveragePower.add(average)
            totalPeakPower = totalPeakPower.add(peak)
            return spec.format.alignCount(average) + " MW"
        })

    // Render breakdowns.
    itemRow = row.filter(d => d.breakdown !== null)
    let breakdown = itemRow.select(function () {
        let row = document.createElement("tr")
        this.parentNode.insertBefore(row, this.nextSibling)
        return row
    })
        .classed("breakdown", true)
        .classed("breakdown-open", function() { return this.previousSibling.classList.contains("breakdown-open") })
    breakdown.append("td")
    row = breakdown.append("td")
        .attr("colspan", totalCols - 1)
        .append("table")
            .selectAll("tr")
            .data(d => d.breakdown)
            .join("tr")
                .classed("breakdown-first-output", d => d.divider)
    let bdIcons = row.append("td")
    bdIcons.append(d => d.item.icon.make(32))
        .classed("item-icon", true)
    bdIcons.append("svg")
        .classed("usage-arrow", true)
        .attr("viewBox", "0 0 18 16")
        .attr("width", 18)
        .attr("height", 16)
        .append("use")
            .attr("href", "images/icons.svg#rightarrow")
    bdIcons.append(d => d.recipe.icon.make(32))
        .classed("item-icon", true)
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .classed("item-rate", true)
            .text(d => spec.format.alignRate(d.rate))
    let beltCell = row.append("td")
        //.classed("item pad", true)
    beltCell.append(d => spec.belt.icon.make(32))
    beltCell.append("span")
        .text(" \u00d7")
    row.append("td")
        //.classed("item right-align", true)
        .append("tt")
            .classed("belt-count", true)
            .text(d => spec.format.alignCount(d.rate.div(spec.belt.rate)))

    let totalPower = [totalAveragePower, totalPeakPower]
    let footerRow = table.selectAll("tfoot tr")
    footerRow.select("td.power-label")
        .attr("colspan", totalCols - 2)
    footerRow.select("tt")
        .data(totalPower)
        .text(d => spec.format.alignCount(d) + " MW")
    table.select("tfoot").raise()
}
