<template>
  <b-card>
    <h4>{{ currentEnv }}</h4>
    <b-button-group>
      <b-button :variant="currentEnv==='dev'? 'success':'outline-warning'" @click="loadAll">
        {{currentEnv==='dev'?'1.':'0.1'}} Load remote
        <b-spinner v-show="loading" small :variant="currentEnv==='dev'? 'light':'success'"></b-spinner>
        <b-icon-box></b-icon-box>
      </b-button>
        <b-button v-show="currentEnv!=='dev'" variant="warning" @click="mergeAll" v-b-tooltip.hover title="use only once to link ids of items">
          0.2 Link Ids with Dev
          <b-spinner v-show="merging" small variant="light"></b-spinner>
        </b-button>
      <b-button :disabled="dev_save_deny" variant="success" v-show="currentEnv==='dev'" @click="saveAll">
        2. Save to folder
        <b-spinner v-show="saving" small variant="light"></b-spinner>
        <b-icon-download></b-icon-download>
      </b-button>
    </b-button-group>

    <b-button v-show="currentEnv!=='dev'" variant="outline-success" class="float-end" @click="publish">
      3. Publish Remote
      <b-spinner v-show="publishing" small variant="light"></b-spinner>
      <b-icon-cloud-upload></b-icon-cloud-upload>
    </b-button>

    <b-skeleton-wrapper class="mt-2" :loading="loading">
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
import {saveAll} from '../../ci/services/tool-to-repostitory'
import {loadAll} from '../../ci/services/metabase-to-tool'
import {publish} from '../../ci/services/publisher'

export default {
  name: 'Queries',
  props: {
    config: {},
    currentEnv: {},
    folder: {}
  },
  data() {
    return {
      dev_save_deny: true,
      loading: false,
      saving: false,
      merging: false,
      publishing: false,
      collections: [],
      queries: [],
      dashboards: []
    }
  },
  methods: {
    async publish() {
      this.publishing = true
      const {url, username, password} = this.config[this.currentEnv]
      await publish({
        url,
        username,
        password,
        env: this.currentEnv,
        folder: this.folder
      })
      this.publishing = false
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
      this.dev_save_deny = false
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
      this.dev_save_deny = true
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