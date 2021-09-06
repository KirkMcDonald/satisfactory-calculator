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

import { spec } from "./factory.js"

export class Icon {
    constructor(name, title) {
        this.name = name
        if (title === undefined) {
            title = name
        }
        this.title = title
    }
    path() {
        return "images/" + this.name + ".png"
    }
    make(size) {
        return d3.select(makeEmptyIcon(size))
            .attr("src", this.path())
            .attr("title", this.title)
            .node()
    }
}

export class ResourceIcon {
    constructor(recipe) {
        this.recipe = recipe
    }
    make(size) {
        let product = this.recipe.products[0].item
        let building = spec.getBuilding(this.recipe)
        if (building === null) {
            return d3.select(product.icon.make(size))
                .attr("title", this.recipe.name + " (extraction)")
                .node()
        }
        let container = d3.create("div")
            .classed("icon-container", true)
        container.append(() => product.icon.make(size))
            .attr("title", this.recipe.name + " (extraction)")
        container.append("img")
            .classed("icon-overlay", true)
            .attr("width", size/2)
            .attr("height", size/2)
            .attr("src", spec.getBuilding(this.recipe).icon.path())
            .attr("title", this.recipe.name + " (extraction)")
        return container.node()
    }
}

export function makeEmptyIcon(size) {
    return d3.create("img")
        .classed("icon", true)
        .attr("width", size)
        .attr("height", size)
        .node()
}
