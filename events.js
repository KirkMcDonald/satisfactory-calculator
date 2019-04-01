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
import { formatSettings } from "./fragment.js"

// build target events

export function plusHandler() {
    spec.addTarget()
    spec.updateSolution()
}

// tab events

export const DEFAULT_TAB = "graph"

export let currentTab = DEFAULT_TAB

export function clickTab(tabName) {
    currentTab = tabName
    d3.selectAll(".tab")
        .style("display", "none")
    d3.selectAll(".tab_button")
        .classed("active", false)
    d3.select("#" + tabName + "_tab")
        .style("display", "block")
    d3.select("#" + tabName + "_button")
        .classed("active", true)
    spec.setHash()
}

// shared events

export function toggleIgnoreHandler(d) {
    spec.toggleIgnore(d.recipe)
    spec.updateSolution()
}

// setting events

export function changeRatePrecision(event) {
    spec.format.ratePrecision = Number(event.target.value)
    spec.updateSolution()
}

export function changeCountPrecision(event) {
    spec.format.countPrecision = Number(event.target.value)
    spec.updateSolution()
}
