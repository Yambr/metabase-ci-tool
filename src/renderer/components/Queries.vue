<template>
  <b-card>
    <h4>{{ currentEnv }}</h4>
    <b-button :variant="currentEnv==='dev'? 'success':'outline-warning'" @click="loadAll">
      {{ currentEnv === 'dev' ? 'Load remote' : 'Load' }}
      <b-spinner v-show="loading" small :variant="currentEnv==='dev'? 'light':'success'"></b-spinner>
    </b-button>
    <b-button variant="success" v-show="currentEnv==='dev'" @click="saveAll">
      Save to folder
      <b-spinner v-show="saving" small variant="light"></b-spinner>
    </b-button>
    <b-button variant="warning" v-show="currentEnv!=='dev'" @click="mergeAll">
      Link Ids with Dev
      <b-spinner v-show="merging" small variant="light"></b-spinner>
    </b-button>
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
import {loadAll, mergeAll, saveAll} from '../services/loadItemsFromPath'

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
      plainCollections: [],
      queries: [],
      dashboards: []
    }
  },
  methods: {
    async loadAll() {
      this.loading = true
      const {url, username, password} = this.config[this.currentEnv]
      const {
        collections,
        plainCollections,
        queries,
        dashboards
      } = await loadAll({url, username, password, env: this.currentEnv})
      this.collections = collections
      this.plainCollections = plainCollections
      this.queries = queries
      this.dashboards = dashboards
      this.loading = false
    },
    async saveAll() {
      this.saving = true
      const {
        collections,
        plainCollections,
        queries,
        dashboards
      } = this
      await saveAll({
        collections,
        plainCollections,
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
        plainCollections,
        queries,
        dashboards
      } = this
      await mergeAll({
        plainCollections,
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