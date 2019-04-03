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
import { toggleIgnoreHandler } from "./events.js"
import { spec } from "./factory.js"
import { Rational, zero, one } from "./rational.js"

class Header {
    constructor(text, colspan) {
        this.text = text
        this.colspan = colspan
    }
}

function changeOverclock(d) {
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

// Remember these values from update to update, to make it simpler to reuse
// elements.
let displayedItems = []

export function displayItems(spec, totals, ignore) {
    let headers = [
        new Header("items/" + spec.format.rateName, 2),
        new Header("belts", 2),
        new Header("buildings", 2),
        new Header("overclock", 1),
        new Header("power", 1),
    ]
    let totalCols = 0
    for (let header of headers) {
        totalCols += header.colspan
    }
    displayedItems = displayedItems.slice(0, totals.topo.length)
    while (displayedItems.length < totals.topo.length) {
        displayedItems.push({})
    }
    let totalAveragePower = zero
    let totalPeakPower = zero
    for (let i = 0; i < totals.topo.length; i++) {
        let recipe = totals.topo[i]
        let display = displayedItems[i]
        let rate = totals.rates.get(recipe)
        let item = recipe.product.item
        let itemRate = rate.mul(recipe.gives(item))
        let overclock = spec.getOverclock(recipe)
        let overclockString = overclock.mul(Rational.from_float(100)).toString()
        let {average, peak} = spec.getPowerUsage(recipe, rate, totals.topo.length)
        totalAveragePower = totalAveragePower.add(average)
        totalPeakPower = totalPeakPower.add(peak)
        display.item = item
        display.itemRate = itemRate
        display.recipe = recipe
        display.ignore = ignore.has(recipe)
        display.rate = rate
        display.building = spec.getBuilding(recipe)
        display.count = spec.getCount(recipe, rate)
        display.overclock = overclockString
        display.average = average
        display.peak = peak
    }

    let table = d3.select("table#totals")

    let headerRow = table.selectAll("thead tr").selectAll("th")
        .data(headers)
    headerRow.exit().remove()
    headerRow.join("th")
        .text(d => d.text)
        .attr("colspan", d => d.colspan)

    // create missing rows
    let rows = table.selectAll("tbody").selectAll("tr")
        .data(displayedItems)
    rows.exit().remove()
    let row = rows.enter()
        .append("tr")
            .classed("display-row", true)
    // items/m
    row.append("td")
        .append("img")
            .classed("icon item-icon", true)
            .attr("width", 32)
            .attr("height", 32)
            .on("click", toggleIgnoreHandler)
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .classed("item-rate", true)
    // belts
    let beltCell = row.append("td")
        .classed("pad", true)
    beltCell.append("img")
        .classed("icon belt-icon", true)
        .attr("width", 32)
        .attr("height", 32)
    beltCell.append(d => new Text(" \u00d7"))
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .classed("belt-count", true)
    // buildings
    let buildingCell = row.append("td")
        .classed("pad building", true)
    buildingCell.append("img")
        .classed("icon building-icon", true)
        .attr("width", 32)
        .attr("height", 32)
    buildingCell.append(d => new Text(" \u00d7"))
    row.append("td")
        .classed("right-align building", true)
        .append("tt")
            .classed("building-count", true)
    /*
    row.filter(d => d.building === null)
        .append("td")
            .attr("colspan", 4)
    */
    // overclock
    let overclockCell = row.append("td")
        .classed("pad building", true)
    overclockCell.append("input")
        .classed("overclock", true)
        .attr("type", "number")
        .attr("title", "")
        .attr("min", 1)
        .attr("max", 250)
        .on("input", changeOverclock)
    overclockCell.append(() => new Text("%"))
    // power
    row.append("td")
        .classed("right-align pad building", true)
        .append("tt")
            .classed("power", true)

    // update rows
    row = table.select("tbody").selectAll("tr")
        .classed("nobuilding", d => d.building === null)
    row.selectAll("img.item-icon")
        .classed("ignore", d => d.ignore)
        .attr("src", d => d.item.iconPath())
        .attr("title", d => d.item.name)
    row.selectAll("tt.item-rate")
        .text(d => spec.format.alignRate(d.itemRate))
    row.selectAll("img.belt-icon")
        .attr("src", spec.belt.iconPath())
        .attr("title", spec.belt.name)
    row.selectAll("tt.belt-count")
        .text(d => spec.format.alignCount(spec.getBeltCount(d.itemRate)))
    let buildingRow = row.filter(d => d.building !== null)
    buildingRow.selectAll("img.building-icon")
        .attr("src", d => d.building.iconPath())
        .attr("title", d => d.building.name)
    buildingRow.selectAll("tt.building-count")
        .text(d => spec.format.alignCount(d.count))
    buildingRow.selectAll("input.overclock")
        .attr("value", d => d.overclock)
    buildingRow.selectAll("tt.power")
        .text(d => spec.format.alignCount(d.average) + " MW")

    let totalPower = [totalAveragePower, totalPeakPower]
    let footerRow = table.selectAll("tfoot tr")
    footerRow.select("td.power-label")
        .attr("colspan", totalCols - 1)
    footerRow.select("tt")
        .data(totalPower)
        .text(d => spec.format.alignCount(d) + " MW")
}
