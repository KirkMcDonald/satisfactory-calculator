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

class Header {
    constructor(text, colspan) {
        this.text = text
        this.colspan = colspan
    }
}

export function displayItems(spec, totals) {
    let headers = [
        new Header("items/" + spec.format.rateName, 2),
        new Header("buildings", 2),
    ]
    // null item to represent the header when we do the join.
    let items = [null]
    for (let recipe of totals.topo) {
        let rate = totals.rates.get(recipe)
        items.push({
            item: recipe.product.item,
            rate: rate,
            building: spec.getBuilding(recipe),
            count: spec.getCount(recipe, rate),
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
    row.append("td")
        .append("img")
            .classed("icon", true)
            .attr("src", d => "images/" + d.item.name + ".png")
            .attr("width", 32)
            .attr("height", 32)
            .attr("title", d => d.item.name)
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(d => spec.format.alignRate(d.rate))
    let buildingCell = row.append("td")
        .classed("pad", true)
    buildingCell.append("img")
        .classed("icon", true)
        .attr("src", d => "images/" + d.building.name + ".png")
        .attr("width", 32)
        .attr("height", 32)
        .attr("title", d => d.building.name)
    buildingCell.append(d => new Text(" \u00d7"))
    row.append("td")
        .classed("right-align", true)
        .append("tt")
            .text(d => spec.format.alignCount(d.count))
}
