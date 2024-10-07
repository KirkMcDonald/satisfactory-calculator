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
import { Icon } from "./icon.js"
import { Rational } from "./rational.js"

class Building {
    constructor(key, name, category, power, maxSomersloop, max) {
        this.key = key
        this.name = name
        this.category = category
        this.power = power
        this.maxSomersloop = maxSomersloop
        this.max = max
        this.icon = new Icon(name)
    }
    getCount(spec, recipe, rate) {
        return rate.div(this.getRecipeRate(spec, recipe))
    }
    getRecipeRate(spec, recipe) {
        let overclock = spec.getOverclock(recipe)
        return recipe.time.reciprocate().mul(overclock)
    }
}

class Miner extends Building {
    constructor(key, name, category, power, baseRate) {
        super(key, name, category, power, null, null)
        this.baseRate = baseRate
    }
    getRecipeRate(spec, recipe) {
        let purity = spec.getResourcePurity(recipe)
        let overclock = spec.getOverclock(recipe)
        return this.baseRate.mul(purity.factor).mul(overclock)
    }
}

export function getBuildings(data) {
    let buildings = []
    for (let d of data.buildings) {
        buildings.push(new Building(
            d.key_name,
            d.name,
            d.category,
            Rational.from_float(d.power),
            Rational.from_float(d.somersloop_slots),
            d.max,
        ))
    }
    for (let d of data.miners) {
        buildings.push(new Miner(
            d.key_name,
            d.name,
            d.category,
            Rational.from_float(d.power),
            Rational.from_float(d.base_rate).div(Rational.from_float(60)),
        ))
    }
    return buildings
}
