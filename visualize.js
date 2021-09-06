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
import { CirclePath, makeCurve } from "./circlepath.js"
import { toggleIgnoreHandler } from "./events.js"
import { spec } from "./factory.js"
import { Rational, zero, one } from "./rational.js"
import { Ingredient } from "./recipe.js"

import * as d3sankey from "./d3-sankey/index.js"

const colorList = [
    "#1f77b4", // blue
    "#8c564b", // brown
    "#2ca02c", // green
    "#d62728", // red
    "#9467bd", // purple
    "#e377c2", // pink
    "#17becf", // cyan
    "#7f7f7f", // gray
    "#bcbd22", // yellow
    "#ff7f0e", // orange
]

const iconSize = 48

const nodePadding = 36

const colonWidth = 12

const columnWidth = 200
const maxNodeHeight = 175

class GraphEdge {
    constructor(source, target, value, item, rate, beltCount, extra) {
        this.source = source
        this.target = target
        this.value = value
        this.item = item
        this.rate = rate
        this.beltCount = beltCount
        this.extra = extra
        this.elements = []
        this.nodeHighlighters = new Set()
    }
    hasHighlighters() {
        return this.nodeHighlighters.size > 0
    }
    highlight(node) {
        if (!this.hasHighlighters()) {
            for (let element of this.elements) {
                element.classList.add("edgePathHighlight")
            }
        }
        this.nodeHighlighters.add(node)
    }
    unhighlight(node) {
        this.nodeHighlighters.delete(node)
        if (!this.hasHighlighters()) {
            for (let element of this.elements) {
                element.classList.remove("edgePathHighlight")
            }
        }
    }
}

class GraphNode {
    constructor(name, recipe, building, count, rate) {
        this.name = name
        this.ingredients = recipe.ingredients
        this.recipe = recipe
        this.building = building || null
        this.count = count
        this.rate = rate
    }
    links() {
        return this.sourceLinks.concat(this.targetLinks)
    }
    text() {
        if (this.rate === null) {
            return this.name
        } else if (this.count.isZero()) {
            return ` \u00d7 ${spec.format.rate(this.rate)}/${spec.format.rateName}`
        } else {
            return ` \u00d7 ${spec.format.count(this.count)}`
        }
    }
    labelWidth(text, margin) {
        text.text(this.text())
        let textWidth = text.node().getBBox().width
        let nodeWidth = textWidth + margin*2
        if (this.building !== null) {
            nodeWidth += iconSize * 2 + colonWidth + 3
        } else if (this.rate !== null) {
            nodeWidth += iconSize + 3
        }
        return nodeWidth
    }
    highlight() {
        this.element.classList.add("nodeHighlight")
        for (let edge of this.links()) {
            edge.highlight(this)
        }
    }
    unhighlight() {
        this.element.classList.remove("nodeHighlight")
        for (let edge of this.links()) {
            edge.unhighlight(this)
        }
    }
}

function makeGraph(totals, ignore) {
    let outputs = []
    let rates = new Map()

    let nodes = []
    let nodeMap = new Map()

    for (let [recipe, rate] of totals.rates) {
        let node = null
        if (recipe.isReal()) {
            let building = spec.getBuilding(recipe)
            let count = spec.getCount(recipe, rate)
            node = new GraphNode(
                recipe.name,
                recipe,
                building,
                count,
                rate,
            )
        } else {
            node = new GraphNode(
                recipe.name,
                recipe,
                null,
                zero,
                null,
            )
        }
        nodes.push(node)
        nodeMap.set(recipe, node)
    }

    let links = []
    for (let {item, from, to, rate} of totals.proportionate) {
        let beltCount = rate.div(spec.belt.rate)
        let extra = from.products.length > 1
        links.push(new GraphEdge(
            nodeMap.get(from),
            nodeMap.get(to),
            rate.toFloat(),
            item,
            rate,
            beltCount,
            extra,
        ))
    }
    return {"nodes": nodes, "links": links}
}

let color = d3.scaleOrdinal(colorList)

function itemNeighbors(item) {
    let touching = new Set()
    let recipes = item.recipes.concat(item.uses)
    for (let recipe of recipes) {
        let ingredients = recipe.ingredients.concat(recipe.products)
        for (let ing of ingredients) {
            touching.add(ing.item)
        }
    }
    return touching
}

function itemDegree(item) {
    return itemNeighbors(item).size
}

function getColorMaps(nodes, links) {
    let itemColors = new Map()
    let recipeColors = new Map()
    let items = []
    for (let link of links) {
        items.push(link.item)
    }
    items.sort(function (a, b) {
        return itemDegree(b) - itemDegree(a)
    })
    items = new Set(items)
    while (items.size > 0) {
        let chosenItem = null
        let usedColors = null
        let max = -1
        for (let item of items) {
            let neighbors = itemNeighbors(item)
            let colors = new Set()
            for (let neighbor of neighbors) {
                if (itemColors.has(neighbor)) {
                    colors.add(itemColors.get(neighbor))
                }
            }
            if (colors.size > max) {
                max = colors.size
                usedColors = colors
                chosenItem = item
            }
        }
        items.delete(chosenItem)
        let color = 0
        while (usedColors.has(color)) {
            color++
        }
        itemColors.set(chosenItem, color)
    }
    // This is intended to be taken modulo the number of colors when it is
    // actually used.
    let recipeColor = 0
    for (let node of nodes) {
        let recipe = node.recipe
        if (recipe.products.length === 1) {
            recipeColors.set(recipe, itemColors.get(recipe.products[0].item))
        } else {
            recipeColors.set(recipe, recipeColor++)
        }
    }
    return [itemColors, recipeColors]
}

function selfPath(d) {
    let x0 = d.source.x1
    let y0 = d.y0
    let x1 = d.source.x1
    let y1 = d.source.y1 + d.width/2 + 10
    let r1 = (y1 - y0) / 2
    let x2 = d.target.x0
    let y2 = d.target.y1 + d.width/2 + 10
    let x3 = d.target.x0
    let y3 = d.y1
    let r2 = (y3 - y2) / 2
    return new CirclePath(1, 0, [
        {x: x0, y: y0},
        {x: x1, y: y1},
        {x: x2, y: y2},
        {x: x3, y: y3},
    ])
}

function backwardPath(d) {
    // start point
    let x0 = d.source.x1
    let y0 = d.y0
    // end point
    let x3 = d.target.x0
    let y3 = d.y1
    let y2a = d.source.y0 - d.width/2 - 10
    let y2b = d.source.y1 + d.width/2 + 10
    let y3a = d.target.y0 - d.width/2 - 10
    let y3b = d.target.y1 + d.width/2 + 10
    let points = [{x: x0, y: y0}]
    let starty
    let endy
    if (y2b < y3a) {
        // draw start arc down, end arc up
        starty = y2b
        endy = y3a
    } else if (y2a > y3b) {
        // draw start arc up, end arc down
        starty = y2a
        endy = y3b
    } else {
        // draw both arcs down
        starty = y2b
        endy = y3b
    }
    let curve = makeCurve(-1, 0, x0, starty, x3, endy)
    for (let {x, y} of curve.points) {
        points.push({x, y})
    }
    points.push({x: x3, y: y3})
    return new CirclePath(1, 0, points)
}

function linkPath(d) {
    if (d.direction === "self") {
        return selfPath(d)
    } else if (d.direction === "backward") {
        return backwardPath(d)
    }
    let x0 = d.source.x1
    let y0 = d.y0
    let x1 = d.target.x0
    let y1 = d.y1
    return makeCurve(1, 0, x0, y0, x1, y1, d.width)
}

export function renderTotals(totals, ignore) {
    let data = makeGraph(totals, ignore)

    let maxNodeWidth = 0
    let testSVG = d3.select("body").append("svg")
        .classed("sankey", true)
    let text = testSVG.append("text")
    for (let node of data.nodes) {
        let nodeWidth = node.labelWidth(text, 2)
        if (nodeWidth > maxNodeWidth) {
            maxNodeWidth = nodeWidth
        }
        node.width = nodeWidth
    }
    text.remove()
    testSVG.remove()

    let sankey = d3sankey.sankey()
        .nodeWidth(maxNodeWidth)
        .nodePadding(nodePadding)
        .nodeAlign(d3sankey.sankeyRight)
        .maxNodeHeight(maxNodeHeight)
        .linkLength(columnWidth)
    let {nodes, links} = sankey(data)
    let [itemColors, recipeColors] = getColorMaps(nodes, links)

    for (let link of links) {
        link.curve = linkPath(link)
        let belts = []
        if (link.beltCount !== null) {
            let dy = link.width / link.beltCount.toFloat()
            // Only render belts if there are at least three pixels per belt.
            if (dy > 3) {
                for (let i = one; i.less(link.beltCount); i = i.add(one)) {
                    let offset = i.toFloat() * dy - link.width/2
                    let beltCurve = link.curve.offset(offset)
                    belts.push({item: link.item, curve: beltCurve})
                }
            }
        }
        link.belts = belts
    }

    let width = 0
    let height = 0
    for (let node of nodes) {
        if (node.x1 > width) {
            width = node.x1
        }
        if (node.y1 > height) {
            height = node.y1
        }
    }

    let margin = 25

    let svg = d3.select("svg#graph")
        .classed("sankey", true)
        .attr("viewBox", `${-margin},-25,${width+margin*2},${height+50}`)
        .style("width", width+margin*2)
        .style("height", height+50)
    svg.selectAll("g").remove()

    // Node rects
    let rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
            .classed("node", true)

    rects.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d3.color(colorList[recipeColors.get(d.recipe) % colorList.length]).darker())
        .attr("stroke", d => colorList[recipeColors.get(d.recipe) % colorList.length])
        .each(function(d) { d.element = this })
    rects.filter(d => d.rate === null)
        .append("text")
            .attr("x", d => (d.x0 + d.x1) / 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(d => d.text())
    let labeledNode = rects.filter(d => d.rate !== null)
    labeledNode.append("image")
        .classed("ignore", d => ignore.has(d.recipe))
        .attr("x", d => d.x0 + 2)
        .attr("y", d => (d.y0 + d.y1) / 2 - (iconSize / 2))
        .attr("height", iconSize)
        .attr("width", iconSize)
        .attr("xlink:href", d => d.recipe.icon.path())
    labeledNode.append("text")
        .attr("x", d => d.x0 + iconSize + (d.building === null ? 0 : colonWidth + iconSize) + 5)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .text(d => d.text())
    let buildingNode = rects.filter(d => d.building !== null)
    buildingNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.x0 + iconSize + colonWidth/2 + 2)
        .attr("cy", d => (d.y0 + d.y1) / 2 - 4)
        .attr("r", 1)
    buildingNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.x0 + iconSize + colonWidth/2 + 2)
        .attr("cy", d => (d.y0 + d.y1) / 2 + 4)
        .attr("r", 1)
    buildingNode.append("image")
        .attr("x", d => d.x0 + iconSize + colonWidth + 2)
        .attr("y", d => (d.y0 + d.y1) / 2 - iconSize/2)
        .attr("height", iconSize)
        .attr("width", iconSize)
        .attr("xlink:href", d => d.building.icon.path())

    // Link paths
    let link = svg.append("g")
        .classed("links", true)
        .selectAll("g")
        .data(links)
        .join("g")
            .classed("link", true)
            .each(function(d) { d.elements.push(this) })
            //.style("mix-blend-mode", "multiply")
    link.append("path")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.3)
        .attr("d", d => d.curve.path())
        .attr("stroke", d => colorList[itemColors.get(d.item) % colorList.length])
        .attr("stroke-width", d => Math.max(1, d.width))
    link.filter(d => d.width >= 3)
        .append("g")
            .selectAll("path")
            .data(d => [
                d.curve.offset(-d.width/2),
                d.curve.offset(d.width/2),
            ])
            .join("path")
                .classed("highlighter", true)
                .attr("fill", "none")
                .attr("d", d => d.path())
                .attr("stroke", "none")
                .attr("stroke-width", 1)
    link.append("g")
        .classed("belts", true)
        .selectAll("path")
        .data(d => d.belts)
        .join("path")
            .classed("belt", true)
            .attr("fill", "none")
            .attr("stroke-opacity", 0.3)
            .attr("d", d => d.curve.path())
            .attr("stroke", d => colorList[itemColors.get(d.item) % colorList.length])
            .attr("stroke-width", 1)
    link.append("title")
        .text(d => `${d.source.name} \u2192 ${d.target.name}\n${spec.format.rate(d.rate)}`)
    link.filter(d => d.extra)
        .append("image")
            .attr("x", d => d.source.x1 + 2)
            .attr("y", d => d.y0 - iconSize/4)
            .attr("height", iconSize/2)
            .attr("width", iconSize/2)
            .attr("xlink:href", d => d.item.icon.path())
    link.append("text")
        .attr("x", d => d.source.x1 + 2 + (d.extra ? iconSize/2 : 0))
        .attr("y", d => d.y0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(d => (d.extra ? "\u00d7 " : "") + spec.format.rate(d.rate) + "/" + spec.format.rateName)

    // Overlay transparent rect on top of each node, for click events.
    let rectElements = svg.selectAll("g.node rect").nodes()
    let overlayData = []
    // Flash the graph tab to be visible, so that the graph is laid out and
    // the BBox is not empty.
    let graphTab = d3.select("#graph_tab")
    let origDisplay = d3.style(graphTab.node(), "display")
    graphTab.style("display", "block")
    for (let i = 0; i < nodes.length; i++) {
        let rect = rectElements[i].getBBox()
        let node = nodes[i]
        let recipe = node.recipe
        overlayData.push({rect, node, recipe})
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
            //.on("click", toggleIgnoreHandler)
            .append("title")
                .text(d => d.node.name + (d.node.count.isZero() ? "" : `\n${d.node.building.name} \u00d7 ${spec.format.count(d.node.count)}`))
}
