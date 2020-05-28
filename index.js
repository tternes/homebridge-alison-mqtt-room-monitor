var http = require('http')
var mqtt = require('mqtt')
var Service, Characteristic
var pkginfo = require('./package.json')

module.exports = function(homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    homebridge.registerAccessory("homebridge-alison-mqtt-room-monitor", "Alison Room Monitor", AlisonRoomMonitor)
}


function AlisonRoomMonitor(log, config) {
  const boardId = config.boardId || 'unknown'
  const manufacturer = config.manufacturer || 'Evening Indie'
  const model = config.model || 'Alison Room Monitor'
  const statusTopic = config.topic || `/alison/${boardId}/status`
  const presenceTopic = config.topic || `/alison/${boardId}/presence`
  const firmwareVersion = pkginfo.version || '0.0.0'

  // register defaults
  config.temperature_enabled = config.temperature_enabled || true
  config.humidity_enabled = config.humidity_enabled || false
  
  this.log = log
  this.config = config
  this.name = config.name
  this.statusTopic = statusTopic
  this.presenceTopic = presenceTopic
  
  this.currentTemperature = 0.0
  this.currentHumidity = 0.0
  
  this.infoService = new Service.AccessoryInformation()
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, manufacturer)
    .setCharacteristic(Characteristic.Model, model)
    .setCharacteristic(Characteristic.SerialNumber, boardId)
    .setCharacteristic(Characteristic.FirmwareRevision, firmwareVersion)

  this.temperatureService = new Service.TemperatureSensor(this.name)
  this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.getCurrentTemperature.bind(this))
  
  this.humidityService = new Service.HumiditySensor(this.name)
  this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on('get', this.getCurrentHumidity.bind(this))

  this.log(`connecting to ${config.url}`)
  this.mqclient = mqtt.connect(config.url)
  
  this.mqclient.on('connect', this.onMqttConnected.bind(this))
  this.mqclient.on('reconnect', this.onMqttReconnected.bind(this))
  this.mqclient.on('message', this.onMqttMessage.bind(this))
}


AlisonRoomMonitor.prototype.onMqttConnected = function () {
  this.log(`mqtt client connected, subscribing to ${this.statusTopic}`)
  this.mqclient.subscribe(this.statusTopic)
  this.mqclient.subscribe(this.presenceTopic)
}


AlisonRoomMonitor.prototype.onMqttReconnected = function() {
  this.log('mqtt client reconnected')
}


AlisonRoomMonitor.prototype.onMqttMessage = function (topic, message) {
  if(topic == this.presenceTopic)
  {
    const presence = message.toString()
    this.log('sensor connection:', presence)
  }

  if(topic == this.statusTopic)
  {
    try {
      var status = JSON.parse(message)
      if(status.env.c != null) {
        this.updateCurrentTemperature(status.env.c)
      }
      if(status.env.h != null) {
        this.updateCurrentHumidity(status.env.h)
      }
    }
    catch(e) {
      console.log(`Failed to parse message: ${message}`)
      console.log(e)
    }
  }  
}


AlisonRoomMonitor.prototype.getCurrentTemperature = function(callback) {
  callback(null, this.currentTemperature)
}


AlisonRoomMonitor.prototype.updateCurrentTemperature = function(degrees) {
  if(this.currentTemperature != degrees) {
    this.log(`updating current temperature ${this.currentTemperature} => ${degrees}`)
    this.currentTemperature = degrees
    var c = this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
    c.getValue()    
  }
}


AlisonRoomMonitor.prototype.getCurrentHumidity = function(callback) {
  callback(null, this.currentHumidity)
}


AlisonRoomMonitor.prototype.updateCurrentHumidity = function(humidity) {
  if(this.currentHumidity != humidity) {
    this.log(`updating current humidity ${this.currentHumidity} => ${humidity}`)
    this.currentHumidity = humidity
    var c = this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
    c.getValue()    
  }
}


AlisonRoomMonitor.prototype.getServices = function() {
  const config = this.config

  var services = Array()
  services.push(this.infoService)
  
  if(config.temperature_enabled) {
    services.push(this.temperatureService)
  }

  if(config.humidity_enabled) {
    services.push(this.humidityService)
  }

  return services
}
