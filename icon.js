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
import { Tooltip } from "./tooltip.js"

// An object representing an icon of an item, recipe, belt, building, or
// whatever else.
//
// Args:
//   obj: The object which this icon will represent. If it provides a
//        renderTooltip() method, this will be used to make a tooltip on the
//        icon available.
//   name: The filename of the image to use. If not provided, defaults to
//         obj.name.
export class Icon {
    constructor(obj, name) {
        if (name === undefined) {
            this.name = obj.name
        } else {
            this.name = name
        }
        this.obj = obj
    }
    path() {
        return "images/" + this.name + ".png"
    }
    // Creates a new <img> node.
    //
    // Args:
    //   size: The width and height of the (square) image, in pixels. If null
    //         or not given, the size will not be set in the markup (and should
    //         probably be set in the style sheet).
    //   suppressTooltip: If true, a tooltip will not be added to this image.
    //   target: The reference node next to which any tooltip will be rendered.
    //           If not provided, defaults to the image itself.
    make(size, suppressTooltip, target) {
        let img = d3.select(makeEmptyIcon(size))
            .attr("src", this.path())
        if (!suppressTooltip && this.obj.renderTooltip) {
            new Tooltip(img.node(), this.obj.renderTooltip(), target)
        } else {
            img.attr("title", this.obj.name)
        }
        return img.node()
    }
}

// XXX: Not actually used, but here for reference if I decide to go with it.
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
    let img = d3.create("img")
        .classed("icon", true)
    if (size) {
        img.attr("width", size)
            .attr("height", size)
    }
    return img.node()
}
