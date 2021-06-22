<template>
  <div>
    <b-alert variant="danger" :show="!config">
      Configure metabase settings
    </b-alert>
    <b-button v-b-modal.settings-modal>Open Settings</b-button>
    <b-modal size="xl" ok-only id="settings-modal" title="Metabase CI Settings">
      <b-form @submit="onSubmit">

        <div v-for="e in envs" :active="e.name==='dev'">
          <b-input-group class="mt-3">
            <template #prepend>
              <b-input-group-text><strong class="text-danger" style="width: 80px">{{ e.name }}</strong>
              </b-input-group-text>
            </template>
            <b-form-input
                v-model="e.url"
                type="url"
                placeholder="Enter Url"
                required
            ></b-form-input>
            <b-form-input
                id="from_username"
                v-model="e.username"
                type="email"
                placeholder="Enter email"
                required
            ></b-form-input>
            <b-form-input
                v-model="e.password"
                type="password"
                placeholder="Enter password"
                required
            ></b-form-input>
          </b-input-group>
        </div>
        <b-button type="submit" variant="success">Save</b-button>
      </b-form>
    </b-modal>
  </div>
</template>
<script>
import {writeSettings} from '../services/loadItemsFromPath'

export default {
  name: 'Settings',
  props: {
    config: {},
    folder: {},
    updateConfig: {}
  },
  mounted() {
    if (this.config) {
      this.envs = Object.keys(this.config).map(name => {
        return {
          name,
          url: this.config[name].url,
          username: this.config[name].username,
          password: this.config[name].password
        }
      })
    } else {
      this.envs = [
        {
          name: 'dev',
          url: undefined,
          username: undefined,
          password: undefined
        },
        {
          name: 'stage',
          url: undefined,
          username: undefined,
          password: undefined
        },
        {
          name: 'production',
          url: undefined,
          username: undefined,
          password: undefined
        }
      ]
    }
  },
  data() {
    return {
      envs: []
    }
  },
  methods: {
    onSubmit(event) {
      event.preventDefault()
      const config = {}
      this.envs.map(({name, url, username, password}) => {
        config[name] = {
          url, username, password
        }
      })
      writeSettings(this.folder, config)
      this.updateConfig(config)
    }
  }
}
</script>
