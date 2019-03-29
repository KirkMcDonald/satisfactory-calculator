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
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION } from "./align.js"
import { DEFAULT_TAB, currentTab } from "./events.js"
import { spec } from "./factory.js"

export function formatSettings() {
    let settings = ""
    if (currentTab !== DEFAULT_TAB) {
        settings += "tab=" + currentTab + "&"
    }
    if (spec.format.rateName !== DEFAULT_RATE) {
        settings += "rate=" + spec.format.rateName + "&"
    }
    if (spec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
        settings += "rp=" + spec.format.ratePrecision + "&"
    }
    if (spec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
        settings += "cp=" + spec.format.countPrecision + "&"
    }
    settings += "items="
    let targetStrings = []
    for (let target of spec.buildTargets) {
        let targetString = ""
        if (target.changedBuilding) {
            targetString = `${target.itemKey}:f:${target.buildingInput.value}`
        } else {
            targetString = `${target.itemKey}:r:${target.rate.toString()}`
        }
        targetStrings.push(targetString)
    }
    settings += targetStrings.join(",")

    return settings
}

export function loadSettings(fragment) {
    let settings = new Map()
    fragment = fragment.substr(1)
    let pairs = fragment.split("&")
    for (let pair of pairs) {
        let i = pair.indexOf("=")
        if (i === -1) {
            continue
        }
        let name = pair.substr(0, i)
        let value = pair.substr(i + 1)
        settings.set(name, value)
    }
    return settings
}
