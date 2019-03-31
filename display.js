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
import { Rational, zero } from "./rational.js"

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
    if (x.less(hundred)) {
        x = hundred
    }
    if (twoFifty.less(x)) {
        x = twoFifty
    }
    x = x.div(hundred)
    spec.setOverclock(d.recipe, x)
    spec.updateSolution()
}

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
    // null item to represent the header when we do the join.
    let items = [null]
    let totalAveragePower = zero
    let totalPeakPower = zero
    for (let recipe of totals.topo) {
        let rate = totals.rates.get(recipe)
        let item = recipe.product.item
        let itemRate = rate.mul(recipe.gives(item))
        let overclock = spec.getOverclock(recipe)
        let overclockString = overclock.mul(Rational.from_float(100)).toString()
        let {average, peak} = spec.getPowerUsage(recipe, rate, totals.topo.length)
        totalAveragePower = totalAveragePower.add(average)
        totalPeakPower = totalPeakPower.add(peak)
        items.push({
            item: item,
            itemRate: itemRate,
            recipe: recipe,
            ignore: ignore.has(recipe),
            rate: rate,
            building: spec.getBuilding(recipe),
            count: spec.getCount(recipe, rate),
            overclock: overclockString,
            average: average,
            peak: peak,
        })
    }

    let table = d3.select("table#totals")
    table.selectAll("tr").remove()
    table.append("tr")
        .selectAll("th")
        .data(headers)
        .join("th")
            .text(d => d.text)
            .attr("colspan", d => d.colspan)

    let row = table.selectAll("tr")
        .data(items)
        .enter().append("tr")
            .classed("display-row", true)
    // items/m
    row.append("td")
        .append("img")
            .classed("icon", true)
            .classed("ignore", d => d.ignore)
            .attr("src", d => "images/" + d.item.name + ".png")
            .attr("width", 32)
            .attr("height", 32)
            .attr("title", d => d.item.name)
            .on("click", toggleIgnoreHandler)
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(d => spec.format.alignRate(d.itemRate))
    // belts
    let beltCell = row.append("td")
        .classed("pad", true)
    beltCell.append("img")
        .classed("icon", true)
        .attr("src", "images/" + spec.belt.name + ".png")
        .attr("width", 32)
        .attr("height", 32)
        .attr("title", spec.belt.name)
    beltCell.append(d => new Text(" \u00d7"))
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(d => spec.format.alignCount(spec.getBeltCount(d.rate)))
    // buildings
    let buildingRow = row.filter(d => d.building !== null)
    let buildingCell = buildingRow.append("td")
        .classed("pad", true)
    buildingCell.append("img")
        .classed("icon", true)
        .attr("src", d => "images/" + d.building.name + ".png")
        .attr("width", 32)
        .attr("height", 32)
        .attr("title", d => d.building.name)
    buildingCell.append(d => new Text(" \u00d7"))
    buildingRow.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(d => spec.format.alignCount(d.count))
    row.filter(d => d.building === null)
        .append("td")
            .attr("colspan", 4)
    // overclock
    let overclockCell = buildingRow.append("td")
        .classed("pad", true)
    overclockCell.append("input")
        .classed("overclock", true)
        .attr("type", "number")
        .attr("value", d => d.overclock)
        .attr("title", "")
        .attr("min", 100)
        .attr("max", 250)
        .on("change", changeOverclock)
    overclockCell.append(() => new Text("%"))
    // power
    buildingRow.append("td")
        .classed("right-align pad", true)
        .append("tt")
            .text(d => spec.format.alignCount(d.average) + " MW")

    let avgRow = table.append("tr")
    avgRow.append("td")
        .classed("right-align", true)
        .attr("colspan", totalCols - 1)
        .append("b")
            .text("total average power: ")
    avgRow.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(spec.format.alignCount(totalAveragePower) + " MW")

    let totRow = table.append("tr")
    totRow.append("td")
        .classed("right-align", true)
        .attr("colspan", totalCols - 1)
        .append("b")
            .text("total peak power: ")
    totRow.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(spec.format.alignCount(totalPeakPower) + " MW")
}
