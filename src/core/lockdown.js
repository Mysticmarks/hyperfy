const isProduction = process.env.NODE_ENV === 'production'

lockdown({
  errorTaming: isProduction ? 'safe' : 'unsafe',
  errorTrapping: isProduction ? 'platform' : 'report',
  unhandledRejectionTrapping: isProduction ? 'platform' : 'report',

  //
  // regExpTaming: 'unsafe',
  // localeTaming: 'unsafe',
  // consoleTaming: 'unsafe',
  // evalTaming: 'unsafeEval',
  // // stackFiltering: ''
  // overrideTaming: 'min',
  // domainTaming: 'unsafe',

  // this is needed for monaco to work correctly.
  // specifically the theming seems to be broken.
  // this shouldn't be an issue as we are not using harden()
  __hardenTaming__: 'unsafe',
})
