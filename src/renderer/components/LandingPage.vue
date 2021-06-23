<template>
  <main>
    <b-container class="mt-5">
      <b-row class="justify-content-center">
        <b-col>
          <b-jumbotron header="Metabase Tool" lead="Import and export tool for metabase">
            <div v-if="!folder">
              <p>Clone repository and choose folder</p>
              <b-button @click="chooseFolder">Choose folder</b-button>
            </div>
          </b-jumbotron>
        </b-col>
      </b-row>
      <b-row v-if="folder">
        <b-col>
          <Settings :config="config" :folder="folder" :updateConfig="updateConfig"/>
        </b-col>
        <b-col v-for="item in envs"  class="text-center">
          <BLink class="link-info" @click="open(config[item].url)">{{ item }}</BLink>
          <b-icon-arrow-right v-if="envs.indexOf(item) < envs.length -1"></b-icon-arrow-right>
        </b-col>
      </b-row>
    </b-container>
    <b-container v-if="config" class="mt-5">
      <div v-for="item in envs" class="mt-2">
        <Queries :config="config" :current-env="item" :folder="folder"/>
        <div class="text-center">
          <b-icon-arrow-down class="text-success" v-if="envs.indexOf(item) < envs.length -1"></b-icon-arrow-down>
        </div>
      </div>
    </b-container>
  </main>
</template>

<script>
import {remote} from 'electron'
import Settings from './Settings'
import Queries from './Queries'
import {readRepository} from '../services/repository-config'

export default {
  name: 'landing-page',
  components: {Queries, Settings},
  data() {
    return {
      currentEnv: 'dev',
      folder: undefined,
      config: undefined
    }
  },
  computed: {
    envs() {
      return this.config ? Object.keys(this.config) : []
    }
  },
  methods: {
    chooseFolder() {
      const dialog = remote.require('electron').dialog
      this.folder = dialog.showOpenDialog({
        properties: ['openDirectory']
      })[0]
      if (this.folder) {
        this.config = readRepository(this.folder)
      }
      console.log(this.folder)
    },
    updateConfig(config) {
      this.config = config
    },
    open(link) {
      this.$electron.shell.openExternal(link)
    }
  }
}
</script>

