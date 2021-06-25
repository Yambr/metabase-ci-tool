// print process.argv

import {publishRemote} from './services/publisher'

let env
let folder

process.argv.forEach(value => {
  if (value.indexOf('env') === 0) {
    env = value.split('=')[1]
  }
  if (value.indexOf('folder') === 0) {
    folder = value.split('=')[1]
  }
})

if (env && folder) {
  publishRemote({env, folder}).then(() => {
    console.log(`published from ${folder} to  ${env}`)
  }).catch(reason => {
    console.error(`Error! ${reason}`)
  })
}
