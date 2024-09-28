/*Copyright 2024 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { spec } from "./factory.js"
import { Rational } from "./rational.js"

class PriorityLevel {
    constructor() {
        this.recipes = new Map()
    }
    copy() {
        let p = new PriorityLevel()
        for (let [r, w] of this.recipes) {
            p.recipes.set(r, w)
        }
        return p
    }
    equal(other) {
        if (this.recipes.size !== other.recipes.size) {
            return false
        }
        for (let [r, w] of this.recipes) {
            if (!other.recipes.has(r) || other.recipes.get(r) !== w) {
                return false
            }
        }
        return true
    }
    getRecipeArray() {
        let r = Array.from(this.recipes.keys())
        r.sort((a, b) => {
            let x = this.recipes.get(a)
            let y = this.recipes.get(b)
            return y.sub(x).toFloat()
        })
        return r
    }
    add(recipe, weight) {
        this.recipes.set(recipe, weight)
    }
    remove(recipe) {
        this.recipes.delete(recipe)
    }
    has(recipe) {
        return this.recipes.has(recipe)
    }
    getWeight(recipe) {
        return this.recipes.get(recipe)
    }
    // Exactly the same as add(), but I feel like this deserves a distinct name.
    setWeight(recipe, weight) {
        this.recipes.set(recipe, weight)
    }
    isEmpty() {
        return this.recipes.size == 0
    }
}

export class PriorityList {
    constructor() {
        this.priority = []
        //this.defaultPriority = null
    }
    [Symbol.iterator]() {
        return this.priority[Symbol.iterator]()
    }
    copy() {
        let p = new PriorityList()
        for (let level of this.priority) {
            p.priority.push(level.copy())
        }
        return p
    }
    equal(other) {
        if (this.priority.length !== other.priority.length) {
            return false
        }
        for (let i=0; i < this.priority.length; i++) {
            if (!this.priority[i].equal(other.priority[i])) {
                return false
            }
        }
        return true
    }
    static getDefault(recipes) {
        let p = new PriorityList()
        for (let [recipeKey, recipe] of recipes) {
            if (recipe.isResource()) {
                let pri = recipe.defaultPriority
                while (p.priority.length < pri + 1) {
                    p.priority.push(new PriorityLevel())
                }
                p.priority[pri].add(recipe, recipe.defaultWeight)
            }
        }
        return p
    }
    /*static fromKeys(tiers, recipes) {
        let p = new PriorityList()
        for (let tier of tiers) {
            let tierList = new PriorityLevel()
            for (let key of tier) {
                let recipe = recipes.get(key)
                if (!recipe) {
                    throw new Error("bad resource key: " + key)
                }
                tierList.add(recipe)
            }
            this.priority.push(tierList)
        }
    }*/
    removeEmpty() {
        let newPriority = []
        for (let p of this.priority) {
            if (!p.isEmpty()) {
                newPriority.push(p)
            }
        }
        this.priority = newPriority
    }
    applyKeys(tiers, recipes) {
        for (let i=0; i < tiers.length; i++) {
            while (this.priority.length < i + 1) {
                this.priority.push(new PriorityLevel())
            }
            let p = this.priority[i]
            for (let [key, weight] of tiers[i]) {
                let recipe = recipes.get(key)
                if (recipe === undefined) {
                    console.log("unknown recipe:", key)
                    continue
                }
                this.setPriority(recipe, weight, p, true)
            }
        }
        this.removeEmpty()
    }
    /*isDefaultPriority() {
        if (this.priority.length !== DEFAULT_PRIORITY.length) {
            return false
        }
        for (let i = 0; i < this.priority.length; i++) {
            let pri = this.priority[i]
            let def = DEFAULT_PRIORITY[i]
            if (pri.recipes.size !== def.length) {
                return false
            }
            for (let name of def) {
                if (!pri.has(this.resourceNameMap.get(name))) {
                    return false
                }
            }
        }
        return true
    }*/
    getPriority(recipe) {
        for (let p of this.priority) {
            if (p.has(recipe)) {
                return p
            }
        }
        return null
    }
    remove(recipe) {
        for (let p of this.priority) {
            if (p.has(recipe)) {
                p.remove(recipe)
                if (p.isEmpty()) {
                    this.removeEmpty()
                }
                return
            }
        }
    }
    // Moves recipe to the given priority level. Optionally sets its weight, as
    // well; preserves the existing weight if `weight` is null. If the recipe's
    // old priority is empty as a result, removes it and returns true (unless
    // preserveEmpty is given and true). Returns false otherwise.
    setPriority(recipe, weight, priority, preserveEmpty) {
        let oldPriority = null
        let oldWeight = null
        let i = 0
        for (; i < this.priority.length; i++) {
            let p = this.priority[i]
            if (p.has(recipe)) {
                oldPriority = p
                oldWeight = p.getWeight(recipe)
                break
            }
        }
        if (weight === null) {
            weight = oldWeight
        }
        priority.add(recipe, weight)
        if (oldPriority !== null && oldPriority !== priority) {
            oldPriority.remove(recipe)
            if (!preserveEmpty && oldPriority.isEmpty()) {
                this.priority.splice(i, 1)
                return true
            }
        }
        return false
    }
    getWeight(recipe) {
        let p = this.getPriority(recipe)
        if (p === null) {
            return null
        }
        return p.getWeight(recipe)
    }
    setWeight(recipe, weight) {
        let p = this.getPriority(recipe)
        if (p === null) {
            return
        }
        p.setWeight(recipe, weight)
    }
    // Creates a new priority level immediately preceding the given one.
    // If the given priority is null, adds the new priority to the end of
    // the priority list.
    //
    // Returns the new PriorityLevel.
    addPriorityBefore(priority) {
        let newPriority = new PriorityLevel()
        if (priority === null) {
            this.priority.push(newPriority)
        } else {
            for (let i = 0; i < this.priority.length; i++) {
                if (this.priority[i] === priority) {
                    this.priority.splice(i, 0, newPriority)
                    break
                }
            }
        }
        return newPriority
    }
}

export class PriorityUI {
    constructor() {
        this.dragitem = null
        this.dragElement = null

        this.div = d3.select("#resource_settings")
        this.elementMap = new Map()
    }

    render() {
        let self = this
        this.div.selectAll("*").remove()
        let less = this.div.append("div")
            .classed("resource-tier bookend", true)
        this.dropTargetBoilerplate(less, function(event, d) {
            let first = spec.priority.priority[0]
            let firstTier = this.nextSibling
            let p = spec.priority.addPriorityBefore(first)
            let oldTier = self.dragElement.parentNode
            let newTier = self.makeTier(p)
            self.div.node().insertBefore(newTier, firstTier)
            self.div.node().insertBefore(self.makeMiddle(first), firstTier)
            let remove = spec.priority.setPriority(self.dragitem, null, p)
            newTier.appendChild(self.dragElement)
            if (remove) {
                self.removeTier(oldTier)
            }
        })
        less.append("span")
            .text("less valuable")
        let first = true
        for (let p of spec.priority.priority) {
            if (!first) {
                this.div.append(() => self.makeMiddle(p))
            }
            first = false
            this.div.append(() => self.makeTier(p))
        }
        let more = this.div.append("div")
            .classed("resource-tier bookend", true)
        this.dropTargetBoilerplate(more, function(event, d) {
            let p = spec.priority.addPriorityBefore(null)
            let oldTier = self.dragElement.parentNode
            self.div.node().insertBefore(self.makeMiddle(p), this)
            let newTier = self.makeTier(p)
            self.div.node().insertBefore(newTier, this)
            let remove = spec.priority.setPriority(self.dragitem, null, p)
            newTier.appendChild(self.dragElement)
            if (remove) {
                self.removeTier(oldTier)
            }
        })
        more.append("span")
            .text("more valuable")
    }

    dropTargetBoilerplate(s, drop) {
        let self = this
        s.on("dragover", function(event, d) {
            event.preventDefault()
        })
        s.on("dragenter", function(event, d) {
            this.classList.add("highlight")
        })
        s.on("dragleave", function(event, d) {
            if (event.target === this) {
                this.classList.remove("highlight")
            }
        })
        s.on("drop", function(event, d) {
            if (self.dragitem === null) {
                return
            }
            event.preventDefault()
            this.classList.remove("highlight")
            drop.call(this, event, d)
            self.dragitem = null
            self.dragElement = null
            spec.updateSolution()
        })
    }

    _getWeightFromElement(resource) {
        return spec.priority.getWeight(this.elementMap.get(resource))
    }
    insertSorted(tier, resource) {
        let weight = this._getWeightFromElement(resource)
        for (let element of tier.childNodes) {
            if (element === resource) {
                continue
            }
            let value = this._getWeightFromElement(element)
            if (value.less(weight)) {
                tier.insertBefore(resource, element)
                return
            }
        }
        tier.appendChild(resource)
    }

    removeTier(tier) {
        let oldMiddle = tier.previousSibling
        if (oldMiddle.classList.contains("middle")) {
            d3.select(oldMiddle).remove()
        } else {
            d3.select(tier.nextSibling).remove()
        }
        d3.select(tier).remove()
    }

    makeTier(p) {
        let self = this
        let tier = d3.create("div")
            .datum(p)
            .classed("resource-tier", true)
        this.dropTargetBoilerplate(tier, function(event, d) {
            if (self.dragElement.parentNode !== this) {
                let remove = spec.priority.setPriority(self.dragitem, null, d)
                let oldTier = self.dragElement.parentNode
                //this.appendChild(self.dragElement)
                self.insertSorted(this, self.dragElement)
                if (remove) {
                    self.removeTier(oldTier)
                }
            }
        })
        let resource = tier.selectAll("div")
            .data(d => d.getRecipeArray())
            .join("div")
        resource.classed("resource", true)
            //.attr("draggable", "true")
            .on("dragstart", function(event, d) {
                self.div.classed("dragging", true)
                self.dragitem = d
                self.dragElement = this
            })
            .on("dragend", function(event, d) {
                self.div.classed("dragging", false)
            })
        resource.append(d => d.icon.make(48))
        resource.append("input")
            .attr("type", "text")
            .attr("size", 4)
            .attr("value", d => spec.priority.getWeight(d).toString())
            .on("change", function(event, d) {
                spec.priority.setWeight(d, Rational.from_string(this.value))
                self.insertSorted(this.parentNode.parentNode, this.parentNode)
                spec.updateSolution()
            })
        resource.each(function(d) {
            self.elementMap.set(this, d)
        })
        return tier.node()
    }

    makeMiddle(p) {
        let self = this
        let middle = d3.create("div")
            .datum(p)
            .classed("middle", true)
        this.dropTargetBoilerplate(middle, function(event, d) {
            let p = spec.priority.addPriorityBefore(d)
            let oldTier = self.dragElement.parentNode
            self.div.node().insertBefore(self.makeMiddle(p), this)
            let newTier = self.makeTier(p)
            self.div.node().insertBefore(newTier, this)
            let remove = spec.priority.setPriority(self.dragitem, null, p)
            newTier.appendChild(self.dragElement)
            if (remove) {
                self.removeTier(oldTier)
            }
        })
        return middle.node()
    }
}
