#!/usr/bin/env node
const Heroku = require('heroku-client')
const Table = require('cli-table');

const heroku = new Heroku({ token: process.env.HEROKU_API_KEY || process.argv[2] })

const priceMap = {
    Free: 0,
    Hobby: 7,
    'Standard-1X': 25,
    'Standard-2X': 50,
    'Performance-M': 250,
    'Performance-L': 500
}


const allApps = async () => {

    try {
        var apps = await heroku.get('/apps')
    } catch (e) {
        console.error('Could not fetch apps from heroku')
        console.error(e)
        process.exit(1)
    }

    const trackedAppConfigs = await Promise.all(apps.map(async (app) => {
      let dynos
      let addons
      let dynoConfig = []
      let addonConfig = []
      try {
        dynos = await heroku.get(`/apps/${app.name}/dynos`)
        addons = await heroku.get(`/apps/${app.name}/addons`)
      } catch (e) {

      }

      if (dynos) {
        dynoConfig = Array.from(dynos).map(dyno => {
          return {
            type: dyno.type,
            size: dyno.size,
            name: dyno.name
          }
        })
      }

      if (addons) {
        addonConfig = Array.from(addons).map(addon => {

          return {
            state: addon.state,
            addon_service: addon.addon_service,
            name: addon.name,
            billed_price: addon.billed_price.cents > 0 ? addon.billed_price.cents / 100 : addon.billed_price.cents,
            plan: addons.plan
          }
        })
      }

      return new Promise((resolve) => {
        resolve({
          name: app.name,
          dynos: dynoConfig,
          addons: addonConfig
        })
      })
    }))
    return trackedAppConfigs
}


(async function() {

    const table = new Table({
        head: ['app', 'dynos', 'addons', 'total monthly']
    });

    const fechApps = allApps()
    let totalCost = 0

    fechApps.then((apps) => {
        apps.forEach(app => {

            if (app.dynos && app.addons) {
                const dynoCost = app.dynos.reduce((cost, dyno) => {
                    if (dyno.type === 'web') {
                        cost += priceMap[dyno.size]
                    }

                    return cost
                }, 0)

                const addonCost = app.addons.reduce((cost, addon) => {
                    cost += addon.billed_price
                    return cost
                }, 0)

                const totalApp = dynoCost + addonCost
                totalCost += totalApp

                const row = [app.name, dynoCost, addonCost, totalApp]
                table.push(row)
            }
        })

        console.log(table.toString())

        console.log('')
        console.log(`Total Monthly Cost: $ ${totalCost}`)
    }).catch((e) => {
        console.error(e)
    })


})()
