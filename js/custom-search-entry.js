(() => {
  const SEARCH_PATH = '/search/'

  const openSearchDialog = event => {
    if (event) event.preventDefault()
    const trigger = document.querySelector('#search-button > .search')
    if (trigger) trigger.click()
  }

  const bindSearchEntry = () => {
    document.querySelectorAll(`a.site-page[href="${SEARCH_PATH}"]`).forEach(link => {
      if (link.dataset.searchBound === '1') return
      link.dataset.searchBound = '1'
      link.addEventListener('click', openSearchDialog)
    })
  }

  document.addEventListener('DOMContentLoaded', bindSearchEntry)
  window.addEventListener('pjax:complete', bindSearchEntry)
})()
