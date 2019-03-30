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
import { Ingredient } from "./recipe.js"

const iconSize = 48

const nodePadding = 20

const columnWidth = 150
const maxNodeHeight = 175

function makeGraph(totals, targets, ignore) {
    let outputs = []
    let rates = new Map()
    for (let target of targets) {
        let rate = rates.get(target.item)
        if (rate === undefined) {
            rate = zero
        }
        rate = rate.add(target.getRate())
        rates.set(target.item, rate)
    }
    for (let [item, rate] of rates) {
        let ing = new Ingredient(item, rate)
        outputs.push(ing)
    }
    let nodes = [{
        "name": "output",
        "ingredients": outputs,
        "building": null,
        "count": zero,
        "rate": null,
    }]
    let nodeMap = new Map()
    nodeMap.set("output", nodes[0])

    for (let [recipe, rate] of totals.rates) {
        let building = spec.getBuilding(recipe)
        let count = spec.getCount(recipe, rate)
        let node = {
            "name": recipe.name,
            "ingredients": recipe.ingredients,
            "recipe": recipe,
            "building": building,
            "count": count,
            "rate": rate,
        }
        nodes.push(node)
        nodeMap.set(recipe.name, node)
    }

    let links = []
    for (let node of nodes) {
        let recipe = node.recipe
        if (ignore.has(recipe)) {
            continue
        }
        for (let ing of node.ingredients) {
            let rate
            if (node.name == "output") {
                rate = ing.amount
            } else {
                rate = totals.rates.get(recipe).mul(ing.amount)
            }
            for (let subRecipe of ing.item.recipes) {
                if (totals.rates.has(subRecipe)) {
                    let link = {
                        "source": nodeMap.get(subRecipe.name),
                        "target": node,
                        "value": rate.toFloat(),
                        "rate": rate,
                    }
                    let belts = []
                    let beltCountExact = spec.getBeltCount(rate)
                    let beltCount = beltCountExact.toFloat()
                    for (let j = one; j.less(beltCountExact); j = j.add(one)) {
                        let i = j.toFloat()
                        belts.push({link, i, beltCount})
                    }
                    link.belts = belts
                    links.push(link)
                }
            }
        }
    }
    return {"nodes": nodes, "links": links}
}

function recipeValue(recipe, rate) {
    let inputValue = zero
    for (let ing of recipe.ingredients) {
        inputValue = inputValue.add(rate.mul(ing.amount))
    }
    let outputValue = rate.mul(recipe.product.amount)
    if (inputValue.less(outputValue)) {
        return outputValue
    } else {
        return inputValue
    }
}

function rankHeightEstimate(rank, valueFactor) {
    let total = nodePadding * (rank.length - 1)
    for (let value of rank) {
        total += value.mul(valueFactor).toFloat()
    }
    return total
}

function nodeText(d) {
    if (d.count.isZero()) {
        if (d.rate === null) {
            return ""
        } else {
            return `\u00d7 ${spec.format.rate(d.rate)}/${spec.format.rateName}`
        }
    } else {
        return "\u00d7 " + spec.format.count(d.count)
    }
}

// This is basically an educated guess, but seems to match whatever Chrome and
// Firefox do pretty well.
function beltPath(d) {
    let x0 = d.link.source.x1
    let y0 = d.link.y0
    let y0top = y0 - d.link.width / 2
    let x1 = d.link.target.x0
    let y1 = d.link.y1
    let y1top = y1 - d.link.width / 2
    let mid = (x1 - x0) / 2
    let slope = (y1 - y0) / (x1 - x0)

    let dy = d.link.width / d.beltCount
    let y_offset = d.i*dy
    let y0belt = y0top + y_offset
    let y1belt = y1top + y_offset

    let midAdjust = (d.link.width/2 - y_offset) * slope
    let x_control = x0 + mid + midAdjust
    return `M ${x0},${y0belt} C ${x_control},${y0belt},${x_control},${y1belt},${x1},${y1belt}`
}

export function renderTotals(totals, targets, ignore) {
    let data = makeGraph(totals, targets, ignore)

    let maxRank = 0
    let ranks = new Map()
    let largestValue = zero
    for (let [recipe, rank] of totals.heights) {
        let rankList = ranks.get(rank)
        if (rankList === undefined) {
            rankList = []
            ranks.set(rank, rankList)
        }
        if (rank > maxRank) {
            maxRank = rank
        }
        let rate = totals.rates.get(recipe)
        let value = recipeValue(recipe, rate)
        if (largestValue.less(value)) {
            largestValue = value
        }
        rankList.push(value)
    }
    if (largestValue.isZero()) {
        return
    }
    let beltDensity = maxNodeHeight / spec.getBeltCount(largestValue).toFloat()
    // The width of the display is the number of ranks, times the width of each
    // rank, plus a small constant for the output node.
    let maxTextWidth = 0
    let testSVG = d3.select("body").append("svg")
    for (let node of data.nodes) {
        let text = testSVG.append("text")
            .text(nodeText(node))
        let textWidth = text.node().getBBox().width
        text.remove()
        if (textWidth > maxTextWidth) {
            maxTextWidth = textWidth
        }
    }
    testSVG.remove()
    let nodeWidth = iconSize + maxTextWidth + 4
    let width = maxRank * (nodeWidth + columnWidth) + nodeWidth
    // The height of the display is normalized by the height of the tallest box
    // in the graph. We define it to be (approximately) maxNodeHeight pixels
    // high.
    let valueFactor = Rational.from_float(maxNodeHeight).div(largestValue)
    let largestEstimate = 0
    for (let [rank, rankList] of ranks) {
        let estimate = rankHeightEstimate(rankList, valueFactor)
        if (estimate > largestEstimate) {
            largestEstimate = estimate
        }
    }
    let height = largestEstimate

    let svg = d3.select("svg#graph")
        .attr("viewBox", `0,0,${width+20},${height+20}`)
        .style("width", width+20)
        .style("height", height+20)

    svg.selectAll("g").remove()

    let sankey = d3.sankey()
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .nodeAlign(d3.sankeyRight)
        .extent([[10, 10], [width + 10, height + 10]])
    let {nodes, links} = sankey(data)

    let color = d3.scaleOrdinal(d3.schemeCategory10)

    // Node rects
    let rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("rect")
        .data(nodes)
        .join("g")
            .classed("node", true)

    rects.append("title")
        .text(d => d.name + (d.count.isZero() ? "" : `\n${d.building.name} \u00d7 ${spec.format.count(d.count)}`))
    rects.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d3.color(color(d.name)).darker())
    rects.filter(d => d.name != "output")
        .append("image")
            .classed("ignore", d => ignore.has(d.recipe))
            .attr("x", d => d.x0 + 2)
            .attr("y", d => d.y0 + (d.y1 - d.y0) / 2 - (iconSize / 2))
            .attr("height", iconSize)
            .attr("width", iconSize)
            .attr("xlink:href", d => "images/" + d.name + ".png")
    rects.append("text")
        .attr("x", d => d.x0 + iconSize + 2)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(nodeText)

    // Link paths
    let link = svg.append("g")
        .classed("links", true)
        .selectAll("g")
        .data(links)
        .join("g")
            //.style("mix-blend-mode", "multiply")
    link.append("path")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.3)
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source.name))
        .attr("stroke-width", d => Math.max(1, d.width))
    // Don't draw belts if we have less than three pixels per belt.
    if (beltDensity >= 3) {
        link.append("g")
            .selectAll("path")
            .data(d => d.belts)
            .join("path")
                .attr("fill", "none")
                .attr("stroke-opacity", 0.3)
                .attr("d", beltPath)
                .attr("stroke", d => color(d.link.source.name))
                .attr("stroke-width", 1)
    }
    link.append("title")
        .text(d => `${d.source.name} \u2192 ${d.target.name}\n${spec.format.rate(d.rate)}`)
    link.append("text")
        .attr("x", d => d.source.x1 + 6)
        .attr("y", d => d.y0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(d => spec.format.rate(d.rate) + "/" + spec.format.rateName)

    // Overlay transparent rect on top of each node, for click events.
    let rectElements = svg.selectAll("g.node").nodes()
    let overlayData = []
    // Flash the graph tab to be visible, so that the graph is laid out and
    // the BBox is not empty.
    let graphTab = d3.select("#graph_tab")
    let origDisplay = d3.style(graphTab.node(), "display")
    graphTab.style("display", "block")
    for (let i = 0; i < nodes.length; i++) {
        let rect = rectElements[i].getBBox()
        let recipe = nodes[i].recipe
        if (recipe !== undefined) {
            overlayData.push({rect, recipe})
        }
    }
    graphTab.style("display", origDisplay)
    svg.append("g")
        .classed("overlay", true)
        .selectAll("rect")
        .data(overlayData)
        .join("rect")
            .attr("stroke", "none")
            .attr("fill", "transparent")
            .attr("x", d => d.rect.x)
            .attr("y", d => d.rect.y)
            .attr("width", d => d.rect.width)
            .attr("height", d => d.rect.height)
            .on("click", toggleIgnoreHandler)
}

