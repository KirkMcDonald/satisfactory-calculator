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
import { renderBoxGraph } from "./boxline.js"
import { installSVGEvents } from "./events.js"
import { spec } from "./factory.js"
import { iconSize, colonWidth } from "./graph.js"
import { zero, one } from "./rational.js"
import { renderSankey } from "./sankey.js"

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

export function renderTotals(totals, ignore) {
    let data = makeGraph(totals, ignore)

    renderSankey(data, ignore)
    //renderBoxGraph(data, ignore)

    let svg = d3.select("svg#graph")
    installSVGEvents(svg)
}
