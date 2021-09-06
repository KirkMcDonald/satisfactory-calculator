/*Copyright 2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

function topoSort(groupMap, groups) {
    let result = []
}

export function getRecipeGroups(recipes) {
    let groups = new Map()
    let items = new Set()
    for (let recipe of recipes) {
        if (recipe.products.length > 0) {
            groups.set(recipe, new Set([recipe]))
            for (let ing of recipe.products) {
                items.add(ing.item)
            }
        }
    }
    for (let item of items) {
        let itemRecipes = []
        for (let recipe of item.recipes) {
            if (recipes.has(recipe)) {
                itemRecipes.push(recipe)
            }
        }
        if (itemRecipes.length > 1) {
            let combined = new Set()
            for (let recipe of itemRecipes) {
                for (let r of groups.get(recipe)) {
                    combined.add(r)
                }
            }
            for (let recipe of combined) {
                groups.set(recipe, combined)
            }
        }
    }
    let groupObjects = new Set()
    for (let [r, group] of groups) {
        groupObjects.add(group)
    }
    return groupObjects
}
