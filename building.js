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
import { Rational } from "./rational.js"

class Building {
    constructor(name, category, power, max) {
        this.name = name
        this.category = category
        this.power = power
        this.max = max
    }
}

class Miner extends Building {
    constructor(name, category, power, baseRate) {
        super(name, category, power, null)
        this.baseRate = baseRate
    }
}

export function getBuildings(data) {
    let buildings = []
    for (let d of data.buildings) {
        buildings.push(new Building(
            d.name,
            d.category,
            Rational.from_float(d.power),
            d.max,
        ))
    }
    for (let d of data.miners) {
        buildings.push(new Miner(
            d.name,
            d.category,
            Rational.from_float(d.power),
            d.base_rate,
        ))
    }
    return buildings
}
