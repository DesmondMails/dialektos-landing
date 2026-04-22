(() => {
  const burger = document.getElementById('burger')
  const mobileMenu = document.getElementById('mobile-menu')
  const burgerOpen = document.getElementById('burger-open')
  const burgerClose = document.getElementById('burger-close')

  if (!burger || !mobileMenu || !burgerOpen || !burgerClose) return

  const setMenuState = (open) => {
    mobileMenu.classList.toggle('hidden', !open)
    burgerOpen.classList.toggle('hidden', open)
    burgerClose.classList.toggle('hidden', !open)
  }

  burger.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden')
    setMenuState(!isOpen)
  })

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false))
  })
})()
