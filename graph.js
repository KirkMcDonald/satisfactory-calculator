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

// Code common between the Sankey and boxline visualizations.

export const colorList = [
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

export const iconSize = 32
export const colonWidth = 12
export const nodeMargin = 2

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

export function getColorMaps(nodes, links) {
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
        if (recipe.products.length === 1 && itemColors.has(recipe.products[0].item)) {
            recipeColors.set(recipe, itemColors.get(recipe.products[0].item))
        } else {
            recipeColors.set(recipe, recipeColor++)
        }
    }
    return [itemColors, recipeColors]
}

export function renderNode(rects, recipeColors, ignore) {
    // main rect
    rects.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d3.color(colorList[recipeColors.get(d.recipe) % colorList.length]).darker())
        .attr("stroke", d => colorList[recipeColors.get(d.recipe) % colorList.length])
        .each(function(d) { d.element = this })
    // plain text node (output, surplus)
    rects.filter(d => d.rate === null)
        .append("text")
            .attr("x", d => (d.x0 + d.x1) / 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(d => d.text())
    let labeledNode = rects.filter(d => d.rate !== null)
    // recipe icon
    labeledNode.append("image")
        .classed("ignore", d => ignore.has(d.recipe))
        .attr("x", d => d.x0 + nodeMargin)
        .attr("y", d => (d.y0 + d.y1) / 2 - (iconSize / 2))
        .attr("height", iconSize)
        .attr("width", iconSize)
        .attr("xlink:href", d => d.recipe.icon.path())
    // node text (building count, or plain rate if no building)
    labeledNode.append("text")
        .attr("x", d => d.x0 + nodeMargin + iconSize + (d.building === null ? 0 : colonWidth + iconSize) /*+ 5*/)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .text(d => d.text())
    let buildingNode = rects.filter(d => d.building !== null)
    // colon
    buildingNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.x0 + nodeMargin + iconSize + colonWidth/2)
        .attr("cy", d => (d.y0 + d.y1) / 2 - 4)
        .attr("r", 1)
    buildingNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.x0 + nodeMargin + iconSize + colonWidth/2)
        .attr("cy", d => (d.y0 + d.y1) / 2 + 4)
        .attr("r", 1)
    // building icon
    buildingNode.append("image")
        .attr("x", d => d.x0 + nodeMargin + iconSize + colonWidth)
        .attr("y", d => (d.y0 + d.y1) / 2 - iconSize/2)
        .attr("height", iconSize)
        .attr("width", iconSize)
        .attr("xlink:href", d => d.building.icon.path())
}
