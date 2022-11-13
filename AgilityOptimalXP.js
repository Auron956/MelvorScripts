/* Used to determine optimal Agility courses in terms of skill XP rate
 * Usage:
 * 1. Copy/paste this class into a browser console window
 * 2. Create a new instance of the class: var oa = new OptimalAgility
 * 3. Obtain optimal course layouts, either:
 *      - At a particular skill level: oa.printOptimalCourse(skillLevel, masteryLevel)
 *      - For all levels: oa.printAllCourses()
 * 
 *      All courses assumes a mastery level of 50, this may be altered in the following ways:
 *      - oa.setMastery(level) sets all obstacles to the specified level
 *      - oa.levelArray may be altered directly to change the level for each obstacle individually
 */
class OptimalAgility {
    constructor() {
        this.obstacleUnlockLevels = [
            0,
            10,
            20,
            30,
            40,
            50,
            60,
            70,
            80,
            90,
            100,
            105,
            110,
            115,
            118
        ];
        // List modifiers with a global impact on the rate of skill XP
        this.globalMods = [
            {name: 'increasedSkillIntervalPercent', skillID: 'melvorD:Agility', group: 'intervalPct', sign: 1},
            {name: 'decreasedSkillIntervalPercent', skillID: 'melvorD:Agility', group: 'intervalPct', sign: -1},
            {name: 'increasedSkillInterval', skillID: 'melvorD:Agility', group: 'interval', sign: 1},
            {name: 'decreasedSkillInterval', skillID: 'melvorD:Agility', group: 'interval', sign: -1},
            {name: 'increasedSkillXP', skillID: 'melvorD:Agility', group: 'skillXP', sign: 1},
            {name: 'decreasedSkillXP', skillID: 'melvorD:Agility', group: 'skillXP', sign: -1},
            {name: 'increasedGlobalSkillXP', group: 'skillXP', sign: 1},
            {name: 'decreasedGlobalSkillXP', group: 'skillXP', sign: -1}
        ];
        // Affects which scenarios are simulated when executing printAllCourses()
        this.levelArray = [
            // [skillLevel, masteryLevel]
            [1, 50],
            [10, 50],
            [20, 50],
            [30, 50],
            [40, 50],
            [50, 50],
            [60, 50],
            [70, 50],
            [80, 50],
            [90, 50],
            [100, 50],
            [105, 50],
            [110, 50],
            [115, 50],
            [118, 50]
        ];
    }

    // Determines the optimal Agility course (in terms of Skill XP) given a skill level & mastery level
    //  for all obstacles
    getOptimalCourse(skillLevel, masteryLevel) {
        const maxCategory = this.obstacleUnlockLevels.filter((level) => level <= skillLevel).length - 1;

        // Determine obstacles containing global modifiers. For categories containing any such
        //  obstacles, these obstacles are to be considered when determining optimal courses
        const globalModObst = [];
        const globalModObstByCat = [];
        game.agility.actions.forEach((obst) => {
            if (obst.modifiers !== undefined) {
                const modValues = this.getGlobalModValues(obst.modifiers);
                if (modValues !== undefined) {
                    globalModObst[obst.id] = modValues;
                    if (globalModObstByCat[obst.category] === undefined) {
                        globalModObstByCat[obst.category] = [];
                    }
                    globalModObstByCat[obst.category].push(obst.id);
                }
            }
        })

        // Determine included obstacles based on skillLevel
        const includedObst = game.agility.actions.filter((obst, idx) => obst.category <= maxCategory);
        var includedCat = includedObst.map((obst, idx) => obst.category);
        includedCat = [...new Set(includedCat)];
        includedCat.sort((a, b) => a > b);

        // For all course lengths up to & including maxCategory, determine an optimal course

        // First determine best base obstacle without global modifiers. For categories lacking
        //  obstacles with global modifiers, these will always be the best choice
        const optimalObstBase = [];
        includedCat.forEach((catID) => {
            const catObst = includedObst.filter((obst) => obst.category === catID && globalModObst[obst.id] === undefined);
            const catObstXP = catObst.map((obst) => this.getObstProps(obst, masteryLevel, {}));
            catObstXP.sort((a, b) => a.xp / a.interval < b.xp / b.interval);
            optimalObstBase[catID] = (catObstXP.length > 0 ? catObstXP[0].id : undefined);
        });

        // For each category, compile an array of each viable obstacle
        const optimalObstChoice = optimalObstBase.map((obstID, catID) => {
            var obstIDs = [];
            if (globalModObstByCat[catID] !== undefined && globalModObstByCat[catID].length > 0) {
                obstIDs = globalModObstByCat[catID];
            }
            if (obstID !== undefined) {
                obstIDs.push(obstID);
            }
            return [...new Set(obstIDs)];
        });

        // Expand the above into an array of each viable course layout
        const optimalObstCombinations = this.getArrayCombinations(optimalObstChoice);

        // Evaluate each course
        var optimalCourse = undefined;
        var maxXPRate = 0;
        optimalObstCombinations.forEach((course) => {
            const totalModValues = this.combineModValues(course.map((obstID) => globalModObst[obstID]));
            const obstProps = course.map((obstID) => this.getObstProps(game.agility.actions.getObjectByID(obstID), masteryLevel, totalModValues));
            const totalXP = obstProps.reduce((pv, cv) => pv + cv['xp'], 0);
            const totalInt = obstProps.reduce((pv, cv) => pv + cv['interval'], 0) / 1000;
            if (totalXP / totalInt > maxXPRate) {
                optimalCourse = obstProps;
                maxXPRate = totalXP / totalInt;
            }
        });

        return optimalCourse;
    }
    printOptimalCourse(skillLevel, masteryLevel) {
        const optimalCourse = this.getOptimalCourse(skillLevel, masteryLevel);
        const totalXP = optimalCourse.reduce((pv, cv) => pv + cv['xp'], 0);
        const totalInt = optimalCourse.reduce((pv, cv) => pv + cv['interval'], 0) / 1000;
        var obstTable = [];
        optimalCourse.forEach((obst, idx) => {
            const obstOut = {
                level: this.levelArray[idx][0],
                obst: game.agility.actions.getObjectByID(obst.id).name,
                XP: obst.xp.toLocaleString(),
                Seconds: (obst.interval / 1000).toLocaleString(),
                XPSec: (obst.xp / (obst.interval / 1000)).toLocaleString()
            };
            obstTable.push(obstOut);
        });
        obstTable.push({
            level: '',
            obst: 'Total',
            XP: totalXP.toLocaleString(),
            Seconds: totalInt.toLocaleString(),
            XPSec: (totalXP / totalInt).toLocaleString()
        });
    
        console.log('Optimal XP/sec is ' + totalXP / totalInt + ' (' + totalInt.toLocaleString() + 's, ' + totalXP.toLocaleString() + ' XP)');
        console.table(obstTable);
        //return optimalCourse.map((obst) => game.agility.actions.getObjectByID(obst.id).name);
    }
    printAllCourses() {
        const results = this.levelArray.map((levels) => this.getOptimalCourse(...levels));
        var resultsOut = [];
        results.forEach((result, idx) => {
            const totalXP = result.reduce((pv, cv) => pv + cv['xp'], 0);
            const totalInt = result.reduce((pv, cv) => pv + cv['interval'], 0) / 1000;
    
            const courseOut = {level: this.levelArray[idx][0], XP: totalXP.toLocaleString(), Seconds: totalInt.toLocaleString(), XPSec: (totalXP / totalInt).toLocaleString()};
            result.forEach((obst, oid) => courseOut['Obst' + (oid + 1).toString().padStart(2, '0')] = game.agility.actions.getObjectByID(obst.id).name);
            resultsOut.push(courseOut);        
        });
        console.table(resultsOut);
        //this.levelArray.forEach((levels) => this.printOptimalCourse(...levels));
    }
    getObstProps(obst, masteryLevel, modifiers) {
        const baseXP = obst.baseExperience;
        const baseInt = obst.baseInterval;
        const modIntMastery = -3 * Math.floor(Math.min(99, masteryLevel) / 10);
        const modIntPct = modIntMastery + (modifiers['intervalPct'] || 0);
        const modInt = modifiers['interval'] || 0;
        const modXP = modifiers['skillXP'] || 0;
    
        const modXPVal = baseXP * (1 + modXP / 100);
        const modIntVal = roundToTickInterval(baseInt * (1 + modIntPct / 100) + modInt);
        if (modXPVal < 0 || modIntVal < 0) {
            console.log('Something is weird: ' + modXPVal + ' & ' + modIntVal);
        }
        return {id: obst.id, xp: modXPVal, interval: modIntVal};
    }
    getGlobalModValues(modObj, masteryLevel = 1) {
        const modValues = {};
        const modGroups = [...new Set(this.globalMods.map((gm) => gm['group']))];
        modGroups.forEach((modGroup) => {
            const groupVal = this.globalMods.filter((gm) => gm['group'] === modGroup).reduce((pv, gm) => pv + (this.getModValue(modObj, gm['name'], gm['skillID'], masteryLevel) || 0) * Math.sign(gm['sign']), 0);
            if (groupVal !== undefined && groupVal !== 0) {
                modValues[modGroup] = groupVal;
            }
        });
        if (Object.keys(modValues).length > 0) {
            return modValues;
        }
    }
    getModValue(modObj, modName, skillID, masteryLevel = 1) {
        const isModNegative = modifierData[modName].isNegative;
        const magnitudeMult = (isModNegative && masteryLevel >= 99 ? 0.5 : 1);
        if ((modObj === undefined) || (modObj.constructor !== Object) || (modObj[modName] === undefined)) {
            return undefined;
        }
        else if ((skillID === undefined) && (modObj[modName].constructor !== Array)) {
            // Modifier value is a single value, so return that
            return modObj[modName] * magnitudeMult;
        }
        else if ((skillID !== undefined) && (modObj[modName].constructor === Array)) {
            // Modifier value is an array of { skill: skillObj, value: magnitude} objects. Aggregate the
            //   magnitudes and return
            const modVal = modObj[modName].reduce((pv, cv) => pv + (cv.skill.id == skillID ? cv.value : 0), 0);
            return (modVal === 0 ? undefined : modVal * magnitudeMult);
        }
        else {
            // Catch all
            return undefined;
        }
    }
    // [{increasedIntervalPercent: 10, ...}, ...]
    combineModValues(modValueArr) {
        var modValues = {};
        modValueArr.filter((i) => i !== undefined).forEach((modValueObj) => {
            Object.keys(modValueObj).forEach((modName) => {
                if (modValues[modName] === undefined) {
                    modValues[modName] = 0;
                }
                modValues[modName] += modValueObj[modName];
            })
        });
        return modValues;
    }
    // Sourced from: https://stackoverflow.com/questions/15298912
    getArrayCombinations(args) {
        var r = [], max = args.length-1;
        function helper(arr, i) {
            for (var j=0, l=args[i].length; j<l; j++) {
                var a = arr.slice(0); // clone arr
                a.push(args[i][j]);
                if (i==max)
                    r.push(a);
                else
                    helper(a, i+1);
            }
        }
        helper([], 0);
        return r;
    }
    setMastery(masteryLevel) {
        if (!isNaN(parseInt(masteryLevel))) {
            const ml = Math.max(1, Math.min(99, masteryLevel));
            this.levelArray = this.levelArray.map((i) => [i[0], ml]);
        }
    }

    listAgilityMods() {
        const mods = new Set();
        game.agility.actions.forEach((obst) => {
            if (obst.modifiers !== undefined) {
                Object.keys(obst.modifiers).forEach((modName, idx) => mods.add(modName));
            }
        });
        return Array.from(mods);
    }
}
