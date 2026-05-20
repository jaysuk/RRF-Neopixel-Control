'use strict'

import { registerRoute } from '@/routes'
import NeopixelControl from './NeopixelControl.vue'

registerRoute(NeopixelControl, {
    Plugins: {
        NeopixelControl: {
            icon: 'mdi-led-strip',
            caption: 'Neopixel Control',
            translated: true,
            path: '/Plugins/NeopixelControl'
        }
    }
})
