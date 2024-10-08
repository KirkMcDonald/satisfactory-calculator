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

class Belt {
    constructor(key, name, rate) {
        this.key = key
        this.name = name
        this.rate = rate
        this.icon = new Icon(this)
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        t.append("b")
            .text(`Max throughput: `)
        t.append(() => new Text(`${spec.format.rate(this.rate)}/${spec.format.longRate}`))
        return t.node()
    }
}

function _getBeltsImpl(d) {
    let belts = new Map()
    for (let belt of d) {
        belts.set(belt.key_name, new Belt(
            belt.key_name,
            belt.name,
            Rational.from_float(belt.rate).div(Rational.from_float(60))
        ))
    }
    return belts
}

export function getBelts(data) {
    return _getBeltsImpl(data.belts)
}

export function getPipes(data) {
    return _getBeltsImpl(data.pipes)
}
