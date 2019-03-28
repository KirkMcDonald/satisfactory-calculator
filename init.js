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
import { getBuildings } from "./building.js"
import { spec } from "./factory.js"
import { getItems } from "./item.js"
import { getRecipes } from "./recipe.js"

function loadData() {
    d3.json("data/data.json").then(function(data) {
        let items = getItems(data)
        let recipes = getRecipes(data, items)
        let buildings = getBuildings(data)
        spec.setData(items, recipes, buildings)

        spec.addTarget()
        spec.updateSolution()
    })
}

export function init() {
    loadData()
}
