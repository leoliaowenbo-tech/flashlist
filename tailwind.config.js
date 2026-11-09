/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tick: {
          blue: '#1976D2',
          blueHover: '#1565C0',
          p1: '#EF4444', // 高优先级 红色
          p2: '#F59E0B', // 中优先级 黄色
          p3: '#3B82F6', // 低优先级 蓝色
          p4: '#9CA3AF', // 无优先级 灰色
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
