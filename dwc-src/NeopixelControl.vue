<template>
    <v-container fluid class="pa-4">

        <!-- Page heading -->
        <div class="d-flex align-center mb-5">
            <v-icon large color="amber darken-1" class="mr-2">mdi-led-strip</v-icon>
            <span class="text-h5 font-weight-bold">Neopixel Control</span>
        </div>

        <!-- No strips configured -->
        <v-alert v-if="ledStrips.length === 0" type="info" outlined>
            No LED strips detected. Configure strips in <code>config.g</code> using
            <code>M950 E&lt;n&gt; C"&lt;pin&gt;" T&lt;type&gt;</code>.
        </v-alert>

        <!-- One card per strip -->
        <v-card
            v-for="(item, si) in ledStrips"
            :key="item.eIndex"
            class="mb-6"
            elevation="4"
        >
            <!-- Coloured header -->
            <div class="strip-header">
                <div class="d-flex align-center">
                    <v-icon color="amber" class="mr-3">mdi-led-strip-variant</v-icon>
                    <div>
                        <div class="white--text font-weight-bold text-subtitle-1">
                            Strip {{ item.eIndex }} &mdash; {{ stripLabel(item.strip.type) }}
                        </div>
                        <div class="white--text caption" style="opacity:.65">
                            {{ item.strip.pin }} &nbsp;&bull;&nbsp; Board {{ item.strip.board }}
                        </div>
                    </div>
                </div>
                <v-btn small dark outlined :disabled="uiFrozen" @click="turnOff(si)">
                    <v-icon small left>mdi-lightbulb-off-outline</v-icon>Off
                </v-btn>
            </div>

            <!-- Stop-movement warning -->
            <v-alert
                v-if="item.strip.stopMovement"
                type="warning"
                dense
                tile
                icon="mdi-pause-circle-outline"
                class="rounded-0 mb-0"
            >
                <strong>Stop-on-update enabled</strong> — changing this strip's colour
                will pause all movement until the update completes.
            </v-alert>

            <v-card-text v-if="states[si]" class="px-5 pt-4 pb-5">

                <!-- ── LED count + Master Brightness ──────────────────── -->
                <v-row dense align="center" class="mb-1">
                    <v-col cols="12" sm="4">
                        <v-text-field
                            v-model.number="states[si].numLeds"
                            label="Number of LEDs"
                            type="number"
                            min="1"
                            max="1000"
                            outlined
                            dense
                            hide-details
                            prepend-inner-icon="mdi-counter"
                            @change="onNumLedsChange(si)"
                        />
                    </v-col>
                    <v-col cols="12" sm="8">
                        <div class="d-flex align-center">
                            <v-icon small class="mr-2 text--secondary">mdi-brightness-6</v-icon>
                            <span class="caption text--secondary mr-3" style="white-space:nowrap">Brightness</span>
                            <v-slider
                                v-model="states[si].brightness"
                                min="0"
                                max="255"
                                thumb-label
                                hide-details
                                color="amber darken-1"
                                class="flex-grow-1 mt-1"
                            />
                            <span class="caption ml-2 text--secondary" style="min-width:26px">
                                {{ states[si].brightness }}
                            </span>
                        </div>
                        <div class="caption text--secondary mt-1" style="padding-left:24px; opacity:.7">
                            Applies to "Set All" only
                        </div>
                    </v-col>
                </v-row>

                <v-divider class="my-4" />

                <!-- ── SET ALL LEDs ────────────────────────────── -->
                <div class="overline text--secondary mb-3">Set All LEDs</div>

                <div class="d-flex align-start">
                    <!-- Large colour swatch — click opens native colour picker -->
                    <div class="all-swatch-wrap mr-4">
                        <div class="all-swatch elevation-3" :style="allSwatchStyle(si)">
                            <input
                                type="color"
                                :value="toHex(states[si].r, states[si].g, states[si].b)"
                                class="swatch-color-input"
                                title="Pick RGB colour"
                                @input="fromHex(si, $event.target.value)"
                            />
                        </div>
                        <div class="text-center mt-1">
                            <code class="caption text--secondary">
                                {{ toHex(states[si].r, states[si].g, states[si].b).toUpperCase() }}
                            </code>
                        </div>
                    </div>

                    <!-- RGBW channel sliders -->
                    <div class="flex-grow-1">
                        <div
                            v-for="ch in channelDefs(si)"
                            :key="ch.key"
                            class="d-flex align-center mb-2"
                        >
                            <span class="ch-lbl font-weight-bold" :class="ch.cls">{{ ch.label }}</span>
                            <v-slider
                                v-model="states[si][ch.key]"
                                min="0"
                                max="255"
                                hide-details
                                dense
                                :color="ch.color"
                                class="flex-grow-1 mx-2"
                            />
                            <span class="ch-val caption text--secondary">{{ states[si][ch.key] }}</span>
                        </div>
                    </div>
                </div>

                <v-btn block color="primary" class="mt-4" :disabled="uiFrozen" @click="applyAll(si)">
                    <v-icon left>mdi-check-all</v-icon>Apply to All LEDs
                </v-btn>

                <v-divider class="my-5" />

                <!-- ── INDIVIDUAL LED CONTROL ──────────────────── -->
                <div class="overline text--secondary mb-3">Individual LED Control</div>

                <!-- Visual pip strip -->
                <div class="pip-strip mb-2">
                    <div
                        v-for="n in states[si].numLeds"
                        :key="n - 1"
                        class="pip"
                        :class="{ 'pip--selected': states[si].selectedLed === n - 1 }"
                        :style="pipStyle(si, n - 1)"
                        :title="`LED ${n - 1}`"
                        @click="selectLed(si, n - 1)"
                    >
                        <span v-if="states[si].numLeds <= 24" class="pip-lbl">{{ n - 1 }}</span>
                    </div>
                </div>

                <div class="caption text--secondary mb-3">
                    <template v-if="states[si].selectedLed !== null">
                        Editing LED <strong>{{ states[si].selectedLed }}</strong>
                        — click a different pip to switch
                    </template>
                    <template v-else>Click a LED to edit it</template>
                </div>

                <!-- Selected LED editor -->
                <v-expand-transition>
                    <v-sheet
                        v-if="states[si].selectedLed !== null"
                        outlined
                        rounded
                        class="pa-4 mb-4 led-editor"
                    >
                        <div class="caption font-weight-bold mb-3 text--secondary text-uppercase">
                            LED {{ states[si].selectedLed }}
                        </div>
                        <div class="d-flex align-start">
                            <!-- Selected LED colour preview -->
                            <div class="sel-swatch mr-4 elevation-2 flex-shrink-0" :style="selSwatchStyle(si)" />
                            <!-- Per-channel sliders (RGBW or RGB) + per-LED brightness -->
                            <div class="flex-grow-1">
                                <div
                                    v-for="ch in channelDefs(si)"
                                    :key="ch.key"
                                    class="d-flex align-center mb-2"
                                >
                                    <span class="ch-lbl font-weight-bold" :class="ch.cls">{{ ch.label }}</span>
                                    <v-slider
                                        :value="getChannel(si, ch.key)"
                                        min="0"
                                        max="255"
                                        hide-details
                                        dense
                                        :color="ch.color"
                                        class="flex-grow-1 mx-2"
                                        @input="setChannel(si, ch.key, $event)"
                                    />
                                    <span class="ch-val caption text--secondary">{{ getChannel(si, ch.key) }}</span>
                                </div>
                                <!-- Per-LED brightness -->
                                <div class="d-flex align-center mb-2">
                                    <v-icon small class="ch-lbl text--secondary">mdi-brightness-6</v-icon>
                                    <v-slider
                                        :value="states[si].individualBrightness[states[si].selectedLed]"
                                        min="0"
                                        max="255"
                                        hide-details
                                        dense
                                        color="amber darken-1"
                                        class="flex-grow-1 mx-2"
                                        @input="$set(states[si].individualBrightness, states[si].selectedLed, $event)"
                                    />
                                    <span class="ch-val caption text--secondary">{{ states[si].individualBrightness[states[si].selectedLed] }}</span>
                                </div>
                            </div>
                        </div>
                    </v-sheet>
                </v-expand-transition>

                <!-- Fill / Clear / Apply -->
                <div class="d-flex flex-wrap align-center" style="gap:8px">
                    <v-btn small outlined :disabled="uiFrozen" @click="fillFromAll(si)">
                        <v-icon small left>mdi-format-paint</v-icon>Fill all from above
                    </v-btn>
                    <v-btn small outlined :disabled="uiFrozen" @click="clearAll(si)">
                        <v-icon small left>mdi-lightbulb-off-outline</v-icon>Clear all
                    </v-btn>
                    <v-spacer />
                    <v-btn color="primary" :disabled="uiFrozen" @click="applyIndividual(si)">
                        <v-icon left>mdi-check</v-icon>Apply Individual
                    </v-btn>
                </div>

            </v-card-text>
        </v-card>
    </v-container>
</template>

<script>
export default {
    name: 'NeopixelControl',

    data() {
        return {
            states: []
        }
    },

    computed: {
        uiFrozen() {
            return this.$store.getters['uiFrozen']
        },
        ledStrips() {
            const strips = this.$store.state.machine?.model?.ledStrips
            if (!Array.isArray(strips)) return []
            // Preserve original index so E parameter in M150 matches RRF strip number,
            // even if strips array is sparse (e.g. strip 0 missing, strip 1 present).
            return strips
                .map((s, i) => s != null ? { strip: s, eIndex: i } : null)
                .filter(x => x !== null)
        }
    },

    watch: {
        ledStrips: {
            immediate: true,
            handler(items) {
                items.forEach((item, i) => {
                    if (!this.states[i]) {
                        const n = this.loadNumLeds(item.strip.pin)
                        this.$set(this.states, i, this.makeState(n))
                    }
                })
                if (this.states.length > items.length) {
                    this.states.splice(items.length)
                }
            }
        }
    },

    methods: {
        // ── State ─────────────────────────────────────────────
        makeState(numLeds) {
            return {
                numLeds,
                brightness: 255,
                // "set all" channels
                r: 255, g: 255, b: 255, w: 0,
                // individual LED channels (separate arrays for full RGBW support)
                selectedLed: 0,
                individualR: Array(numLeds).fill(0),
                individualG: Array(numLeds).fill(0),
                individualB: Array(numLeds).fill(0),
                individualW: Array(numLeds).fill(0),
                individualBrightness: Array(numLeds).fill(255)
            }
        },

        // ── localStorage ──────────────────────────────────────
        loadNumLeds(pin) {
            try {
                const n = parseInt(localStorage.getItem(`np-leds-${pin}`), 10)
                if (n > 0 && n <= 1000) return n
            } catch (e) {}
            return 30
        },
        saveNumLeds(pin, n) {
            try { localStorage.setItem(`np-leds-${pin}`, String(n)) } catch (e) {}
        },

        // ── Strip helpers ─────────────────────────────────────
        stripLabel(type) {
            return {
                NeoPixel_RGB: 'NeoPixel RGB',
                NeoPixel_RGBW: 'NeoPixel RGBW',
                DotStar: 'DotStar'
            }[type] || type || 'Unknown'
        },
        isRGBW(strip) {
            return strip && strip.type === 'NeoPixel_RGBW'
        },
        channelDefs(si) {
            const defs = [
                { key: 'r', label: 'R', color: 'red darken-1',   cls: 'red--text' },
                { key: 'g', label: 'G', color: 'green darken-1', cls: 'green--text' },
                { key: 'b', label: 'B', color: 'blue darken-1',  cls: 'blue--text' }
            ]
            if (this.isRGBW(this.ledStrips[si].strip)) {
                defs.push({ key: 'w', label: 'W', color: 'grey', cls: 'text--secondary' })
            }
            return defs
        },

        // ── Colour math ───────────────────────────────────────
        toHex(r, g, b) {
            return '#' + [r, g, b]
                .map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0'))
                .join('')
        },
        fromHex(si, hex) {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
            if (!m) return
            const s = this.states[si]
            s.r = parseInt(m[1], 16)
            s.g = parseInt(m[2], 16)
            s.b = parseInt(m[3], 16)
        },
        scale(v, bri) {
            return Math.round(v * bri / 255)
        },
        blendPreview(r, g, b, w) {
            return [Math.min(255, r + w), Math.min(255, g + w), Math.min(255, b + w)]
        },

        // ── Style helpers ─────────────────────────────────────
        allSwatchStyle(si) {
            const s = this.states[si]
            const bri = s.brightness / 255
            const w = this.isRGBW(this.ledStrips[si].strip) ? Math.round(s.w * bri) : 0
            const [r, g, b] = this.blendPreview(
                Math.round(s.r * bri), Math.round(s.g * bri), Math.round(s.b * bri), w
            )
            return { background: (r + g + b) ? `rgb(${r},${g},${b})` : '#111' }
        },
        pipStyle(si, i) {
            const s = this.states[si]
            const bri = s.individualBrightness[i] !== undefined ? s.individualBrightness[i] : 255
            const w = this.isRGBW(this.ledStrips[si].strip) ? Math.round((s.individualW[i] || 0) * bri / 255) : 0
            const [r, g, b] = this.blendPreview(
                Math.round((s.individualR[i] || 0) * bri / 255),
                Math.round((s.individualG[i] || 0) * bri / 255),
                Math.round((s.individualB[i] || 0) * bri / 255),
                w
            )
            return {
                background: (r + g + b) ? `rgb(${r},${g},${b})` : null,
                outline: s.selectedLed === i ? '3px solid #1976D2' : '3px solid transparent',
                outlineOffset: '2px'
            }
        },
        selSwatchStyle(si) {
            const s = this.states[si]
            const led = s.selectedLed
            if (led === null) return {}
            const bri = s.individualBrightness[led] !== undefined ? s.individualBrightness[led] : 255
            const w = this.isRGBW(this.ledStrips[si].strip) ? Math.round((s.individualW[led] || 0) * bri / 255) : 0
            const [r, g, b] = this.blendPreview(
                Math.round((s.individualR[led] || 0) * bri / 255),
                Math.round((s.individualG[led] || 0) * bri / 255),
                Math.round((s.individualB[led] || 0) * bri / 255),
                w
            )
            return { background: (r + g + b) ? `rgb(${r},${g},${b})` : '#111' }
        },

        // ── Individual LED editing ────────────────────────────
        selectLed(si, i) {
            this.states[si].selectedLed = i
        },
        getChannel(si, ch) {
            const s = this.states[si]
            if (s.selectedLed === null) return 0
            return s[`individual${ch.toUpperCase()}`][s.selectedLed] || 0
        },
        setChannel(si, ch, value) {
            const s = this.states[si]
            if (s.selectedLed === null) return
            this.$set(s[`individual${ch.toUpperCase()}`], s.selectedLed, value)
        },

        // ── Strip config ──────────────────────────────────────
        onNumLedsChange(si) {
            const s = this.states[si]
            const n = Math.max(1, Math.min(1000, Math.floor(s.numLeds) || 1))
            s.numLeds = n
            this.saveNumLeds(this.ledStrips[si].strip.pin, n)
            for (const key of ['individualR', 'individualG', 'individualB', 'individualW']) {
                while (s[key].length < n) s[key].push(0)
                if (s[key].length > n) s[key].splice(n)
            }
            while (s.individualBrightness.length < n) s.individualBrightness.push(255)
            if (s.individualBrightness.length > n) s.individualBrightness.splice(n)
            if ((s.selectedLed || 0) >= n) s.selectedLed = n - 1
        },

        fillFromAll(si) {
            const s = this.states[si]
            this.$set(this.states[si], 'individualR', Array(s.numLeds).fill(s.r))
            this.$set(this.states[si], 'individualG', Array(s.numLeds).fill(s.g))
            this.$set(this.states[si], 'individualB', Array(s.numLeds).fill(s.b))
            this.$set(this.states[si], 'individualW', Array(s.numLeds).fill(s.w))
        },
        clearAll(si) {
            for (const k of ['individualR', 'individualG', 'individualB', 'individualW']) {
                this.$set(this.states[si], k, Array(this.states[si].numLeds).fill(0))
            }
        },

        // ── GCode ─────────────────────────────────────────────
        async send(code) {
            try {
                await this.$store.dispatch('machine/sendCode', { code, noWait: false })
            } catch (e) {
                console.error('NeopixelControl: send failed', e)
            }
        },
        async applyAll(si) {
            const s = this.states[si]
            const bri = s.brightness
            const e = this.ledStrips[si].eIndex
            let cmd = `M150 E${e} R${this.scale(s.r, bri)} U${this.scale(s.g, bri)} B${this.scale(s.b, bri)}`
            if (this.isRGBW(this.ledStrips[si].strip)) cmd += ` W${this.scale(s.w, bri)}`
            cmd += ` S${s.numLeds} F0`
            await this.send(cmd)
        },
        async applyIndividual(si) {
            const s = this.states[si]
            const e = this.ledStrips[si].eIndex
            const rgbw = this.isRGBW(this.ledStrips[si].strip)
            const lines = []
            for (let i = 0; i < s.numLeds; i++) {
                const bri = s.individualBrightness[i] !== undefined ? s.individualBrightness[i] : 255
                let line = `M150 E${e}`
                    + ` R${this.scale(s.individualR[i] || 0, bri)}`
                    + ` U${this.scale(s.individualG[i] || 0, bri)}`
                    + ` B${this.scale(s.individualB[i] || 0, bri)}`
                if (rgbw) line += ` W${this.scale(s.individualW[i] || 0, bri)}`
                line += i < s.numLeds - 1 ? ' S1 F1' : ' S1 F0'
                lines.push(line)
            }
            await this.send(lines.join('\n'))
        },
        async turnOff(si) {
            const s = this.states[si]
            const e = this.ledStrips[si].eIndex
            let cmd = `M150 E${e} R0 U0 B0`
            if (this.isRGBW(this.ledStrips[si].strip)) cmd += ' W0'
            cmd += ` S${s.numLeds} F0`
            await this.send(cmd)
        }
    }
}
</script>

<style scoped>
/* ── Strip header ──────────────────────────────────────── */
.strip-header {
    background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: 4px 4px 0 0;
}

/* ── "Set All" swatch ──────────────────────────────────── */
.all-swatch-wrap { flex-shrink: 0; }
.all-swatch {
    width: 88px;
    height: 88px;
    border-radius: 14px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid rgba(0,0,0,.15);
    background: #111;
}
.swatch-color-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
}

/* ── Channel label + value ──────────────────────────────── */
.ch-lbl { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }
.ch-val  { min-width: 28px; text-align: right; flex-shrink: 0; }

/* ── LED pip strip ──────────────────────────────────────── */
.pip-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 10px;
    background: rgba(0,0,0,.04);
    border-radius: 10px;
    max-height: 240px;
    overflow-y: auto;
}
.theme--dark .pip-strip { background: rgba(255,255,255,.05); }

.pip {
    width: 36px;
    height: 36px;
    border-radius: 7px;
    cursor: pointer;
    background: rgba(120,120,120,.18);
    border: 1px solid rgba(0,0,0,.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform .1s, outline .1s;
    user-select: none;
}
.pip:hover    { transform: scale(1.18); z-index: 1; }
.pip--selected { outline: 3px solid #1976D2; outline-offset: 2px; }

.pip-lbl {
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.9);
    text-shadow: 0 0 4px rgba(0,0,0,.9);
    pointer-events: none;
}

/* ── Selected LED editor panel ──────────────────────────── */
.led-editor { background: rgba(0,0,0,.025) !important; }
.theme--dark .led-editor { background: rgba(255,255,255,.03) !important; }

.sel-swatch {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    border: 2px solid rgba(0,0,0,.12);
    background: #111;
    flex-shrink: 0;
}
</style>
