export default {
  index: {
    type: 'page',
    title: '首页',
    display: 'hidden'
  },
  courses: {
    type: 'page',
    title: '课程'
  },
  studio: {
    type: 'page',
    title: 'Studio',
    display: 'hidden',
    theme: {
      layout: 'full',
      sidebar: false,
      toc: false,
      breadcrumb: false,
      pagination: false,
      navbar: false,
      footer: false
    }
  }
}
