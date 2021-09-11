/*Copyright 2021 Kirk McDonald

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
import { spec } from "./factory.js"
import { colorList, iconSize, getColorMaps, renderNode } from "./graph.js"
import { one } from "./rational.js"

import * as d3sankey from "./d3-sankey/index.js"

const nodePadding = 36

const columnWidth = 200
const maxNodeHeight = 175

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

export function renderSankey(data, ignore) {
    let maxNodeWidth = 0
    let testSVG = d3.select("body").append("svg")
        .classed("sankey test", true)
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

    let svg = d3.select("svg#graph")
        .classed("sankey", true)
    svg.selectAll("g").remove()

    // Node rects
    let rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
            .classed("node", true)

    renderNode(rects, recipeColors, ignore)

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
