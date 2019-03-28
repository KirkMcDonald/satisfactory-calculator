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
import { spec } from "./factory.js"
import { Rational, zero } from "./rational.js"
import { Ingredient } from "./recipe.js"

const iconSize = 48

const nodeWidth = iconSize*2 + 4
const nodePadding = 20

const columnWidth = nodeWidth + 150
const maxNodeHeight = 175

function makeGraph(totals, targets) {
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
    let nodes = [{"name": "output", "ingredients": outputs, "count": zero}]
    let nodeMap = new Map()
    nodeMap.set("output", nodes[0])

    for (let [recipe, rate] of totals.rates) {
        let count = spec.getCount(recipe, rate)
        let node = {
            "name": recipe.name,
            "ingredients": recipe.ingredients,
            "recipe": recipe,
            "count": count,
        }
        nodes.push(node)
        nodeMap.set(recipe.name, node)
    }

    let links = []
    for (let node of nodes) {
        let recipe = node.recipe
        for (let ing of node.ingredients) {
            let rate
            if (node.name == "output") {
                rate = ing.amount
            } else {
                rate = totals.rates.get(recipe).mul(ing.amount)
            }
            for (let subRecipe of ing.item.recipes) {
                let recipeRate = totals.rates.get(subRecipe)
                if (recipeRate) {
                    links.push({
                        "source": nodeMap.get(subRecipe.name),
                        "target": node,
                        "value": rate.toFloat(),
                        "rate": rate,
                    })
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

export function renderTotals(totals, targets) {
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
    console.log(maxRank)
    // The width of the display is the number of ranks, times the width of each
    // rank, plus a small constant for the output node.
    let width = maxRank * columnWidth + nodeWidth
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

    let data = makeGraph(totals, targets)

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
            //.attr("stroke", "#000000")
        .selectAll("rect")
        .data(nodes)
        .join("g")
            .classed("node", true)

    rects.append("title")
        .text(d => `${d.name}\nBuildings \u00d7 ${spec.format.count(d.count)}`)
    rects.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d3.color(color(d.name)).darker())
    rects.filter(d => d.name != "output")
        .append("image")
            .attr("x", d => d.x0 + 2)
            .attr("y", d => d.y0 + (d.y1 - d.y0) / 2 - (iconSize / 2))
            .attr("height", iconSize)
            .attr("width", iconSize)
            .attr("xlink:href", d => "images/" + d.name + ".png")

    // Link paths
    let link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.3)
        .selectAll("g")
        .data(links)
        .join("g")
            //.style("mix-blend-mode", "multiply")

    link.append("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source.name))
        .attr("stroke-width", d => Math.max(1, d.width))

    link.append("title")
        .text(d => `${d.source.name} \u2192 ${d.target.name}\n${spec.format.rate(d.rate)}`)

    // Building count labels
    svg.append("g")
            .classed("countLabel", true)
        .selectAll("text")
        .data(nodes)
        .join("text")
            .attr("x", d => d.x0 + iconSize + 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .text(d => d.count.isZero() ? "" : "\u00d7 " + spec.format.count(d.count))

    // Link rate labels
    svg.append("g")
        .selectAll("text")
        .data(links)
        .join("text")
            .attr("x", d => d.source.x1 + 6)
            .attr("y", d => d.y0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .text(d => spec.format.rate(d.rate) + "/" + spec.format.rateName)
}

