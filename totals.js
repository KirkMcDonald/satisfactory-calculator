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
import { zero } from "./rational.js"

export class Totals {
    constructor() {
        this.rates = new Map()
        this.heights = new Map()
        this.topo = []
    }
    add(recipe, rate) {
        this.topo.push(recipe)
        this.rates.set(recipe, (this.rates.get(recipe) || zero).add(rate))
    }
    updateHeight(recipe, height) {
        let knownHeight = this.heights.get(recipe)
        if (knownHeight === undefined || knownHeight < height) {
            this.heights.set(recipe, height)
        }
    }
    combine(other) {
        let newTopo = []
        for (let recipe of this.topo) {
            if (!other.rates.has(recipe)) {
                newTopo.push(recipe)
            }
        }
        newTopo = newTopo.concat(other.topo)
        for (let [recipe, rate] of other.rates) {
            this.add(recipe, rate)
        }
        this.topo = newTopo
        for (let [recipe, height] of other.heights) {
            this.updateHeight(recipe, height + 1)
        }
    }
}
