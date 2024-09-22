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
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION } from "./align.js"
import { DEFAULT_TAB, currentTab } from "./events.js"
import { spec, DEFAULT_PURITY, DEFAULT_BELT } from "./factory.js"
import { Rational } from "./rational.js"

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
    if (spec.belt.key !== DEFAULT_BELT) {
        settings += "belt=" + spec.belt.key + "&"
    }

    settings += "items="
    let targetStrings = []
    for (let target of spec.buildTargets) {
        let targetString = ""
        if (target.changedBuilding) {
            targetString = `${target.itemKey}:f:${target.buildingInput.value}`
        } else {
            targetString = `${target.itemKey}:r:${target.rate.mul(spec.format.rateFactor).toString()}`
        }
        targetStrings.push(targetString)
    }
    settings += targetStrings.join(",")

    let ignore = []
    for (let recipe of spec.ignore) {
        ignore.push(recipe.key)
    }
    if (ignore.length > 0) {
        settings += "&ignore=" + ignore.join(",")
    }

    if (!spec.isDefaultDisable()) {
        let disable = []
        for (let d of spec.disable) {
            disable.push(d.key)
        }
        settings += "&disable=" + disable.join(",")
    }

    if (!spec.isDefaultPriority()) {
        let priority = []
        for (let tier of spec.priority) {
            let keys = []
            for (let p of tier.recipes) {
                keys.push(p.key)
            }
            priority.push(keys.join(","))
        }
        settings += "&priority=" + priority.join(";")
    }

    let overclock = []
    for (let [recipe, factor] of spec.overclock) {
        let s = factor.mul(Rational.from_float(100)).toString()
        overclock.push(`${recipe.key}:${s}`)
    }
    if (overclock.length > 0) {
        settings += "&overclock=" + overclock.join(",")
    }

    let minerStrings = []
    for (let [recipe, {miner, purity}] of spec.minerSettings.entries()) {
        let miners = spec.buildings.get(recipe.category)
        let defaultMiner = miners[0]
        if (miner !== defaultMiner || purity !== DEFAULT_PURITY) {
            let s = `${recipe.key}:${miner.key}:${purity.key}`
            minerStrings.push(s)
        }
    }
    if (minerStrings.length > 0) {
        settings += "&miners=" + minerStrings.join(",")
    }

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
