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
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, longRateNames } from "./align.js"
import { DEFAULT_TAB, clickTab } from "./events.js"
import { spec } from "./factory.js"

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// tab

function renderTab(settings) {
    let tabName = DEFAULT_TAB
    if (settings.has("tab")) {
        tabName = settings.get("tab")
    }
    clickTab(tabName)
}

// display rate

function rateHandler() {
    spec.format.setDisplayRate(this.value)
    spec.updateSolution()
}

function renderRateOptions(settings) {
    let rateName = DEFAULT_RATE
    if (settings.has("rate")) {
        rateName = settings.get("rate")
    }
    spec.format.setDisplayRate(rateName)
    let rates = []
    for (let [rateName, longRateName] of longRateNames) {
        rates.push({rateName, longRateName})
    }
    let form = d3.select("#display_rate")
    form.selectAll("*").remove()
    let rateOption = form.selectAll("span")
        .data(rates)
        .join("span")
    rateOption.append("input")
        .attr("id", d => d.rateName + "_rate")
        .attr("type", "radio")
        .attr("name", "rate")
        .attr("value", d => d.rateName)
        .attr("checked", d => d.rateName === rateName ? "" : null)
        .on("change", rateHandler)
    rateOption.append("label")
        .attr("for", d => d.rateName + "_rate")
        .text(d => "items/" + d.longRateName)
    rateOption.append("br")
}

function renderPrecisions(settings) {
    spec.format.ratePrecision = DEFAULT_RATE_PRECISION
    if (settings.has("rp")) {
        spec.format.ratePrecision = Number(settings.get("rp"))
    }
    d3.select("#rprec").attr("value", spec.format.ratePrecision)
    spec.format.countPrecision = DEFAULT_COUNT_PRECISION
    if (settings.has("cp")) {
        spec.format.countPrecision = Number(settings.get("cp"))
    }
    d3.select("#cprec").attr("value", spec.format.countPrecision)
}

export function renderSettings(settings) {
    renderTab(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
}
