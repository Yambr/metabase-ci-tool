<template>
  <b-card>
    <h4>{{ currentEnv }}</h4>
    <b-button-group>
      <b-button :variant="currentEnv==='dev'? 'success':'outline-warning'" @click="loadAll">
        Load remote
        <b-spinner v-show="loading" small :variant="currentEnv==='dev'? 'light':'success'"></b-spinner>
        <b-icon-box></b-icon-box>
      </b-button>
      <b-button variant="success" v-show="currentEnv==='dev'" @click="saveAll">
        Save to folder
        <b-spinner v-show="saving" small variant="light"></b-spinner>
        <b-icon-download></b-icon-download>
      </b-button>
    </b-button-group>

    <b-button variant="outline-warning" class="float-end" @click="publish">
      Publish Remote
      <b-icon-cloud-upload></b-icon-cloud-upload>
    </b-button>
    <div v-show="currentEnv!=='dev'" class="mt-2">
      <b-button variant="warning" @click="mergeAll">
        Link Ids with Dev
        <b-spinner v-show="merging" small variant="light"></b-spinner>
      </b-button>
      use only once!
    </div>

    <b-skeleton-wrapper :loading="loading">
      <template #loading>
        <b-container>
          <b-row>
            <b-col>
              <b-skeleton></b-skeleton>
            </b-col>
            <b-col>
              <b-skeleton></b-skeleton>
            </b-col>
            <b-col>
              <b-skeleton></b-skeleton>
            </b-col>
          </b-row>
        </b-container>
      </template>
      <b-container class="text-center">
        <b-row>
          <b-col>
            Collections {{ collections.length }}
          </b-col>
          <b-col>
            Cards {{ queries.length }}
          </b-col>
          <b-col>
            Dasboards {{ dashboards.length }}
          </b-col>
        </b-row>
      </b-container>
    </b-skeleton-wrapper>
  </b-card>
</template>
<script>
import {mergeAllByDev} from '../services/first-merge-ids-by-dev'
import {saveAll} from '../services/tool-to-repostitory'
import {loadAll} from '../services/metabase-to-tool'
import {publish} from '../services/publisher'

export default {
  name: 'Queries',
  props: {
    config: {},
    currentEnv: {},
    folder: {}
  },
  data() {
    return {
      loading: false,
      saving: false,
      merging: false,
      collections: [],
      queries: [],
      dashboards: []
    }
  },
  methods: {
    async publish() {
      const {url, username, password} = this.config[this.currentEnv]
      await publish({
        url,
        username,
        password,
        env: this.currentEnv,
        folder: this.folder
      })
    },
    async loadAll() {
      this.loading = true
      const {url, username, password} = this.config[this.currentEnv]
      const {
        collections,
        queries,
        dashboards
      } = await loadAll({url, username, password, env: this.currentEnv, folder: this.folder})
      this.collections = collections
      this.queries = queries
      this.dashboards = dashboards
      this.loading = false
    },
    async saveAll() {
      this.saving = true
      const {
        collections,
        queries,
        dashboards
      } = this
      await saveAll({
        collections,
        queries,
        dashboards,
        env: this.currentEnv,
        folder: this.folder
      })
      this.saving = false
    },
    async mergeAll() {
      this.merging = true
      const {
        collections,
        queries,
        dashboards
      } = this
      await mergeAllByDev({
        collections,
        queries,
        dashboards,
        env: this.currentEnv,
        folder: this.folder
      })
      this.merging = false
    }

  }
}
</script>