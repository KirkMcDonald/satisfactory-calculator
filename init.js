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
import { getBelts } from "./belt.js"
import { getBuildings } from "./building.js"
import { spec } from "./factory.js"
import { loadSettings } from "./fragment.js"
import { getItems } from "./item.js"
import { getRecipes } from "./recipe.js"
import { renderSettings } from "./settings.js"

function loadData(settings) {
    d3.json("data/data.json", {cache: "reload"}).then(function(data) {
        let items = getItems(data)
        let recipes = getRecipes(data, items)
        let buildings = getBuildings(data)
        let belts = getBelts(data)
        spec.setData(items, recipes, buildings, belts)

        renderSettings(settings)

        spec.updateSolution()
    })
}

export function init() {
    let settings = loadSettings(window.location.hash)
    loadData(settings)
}
