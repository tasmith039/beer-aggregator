const cronService = async () => {
    console.log('run')
    await fetch('http://localhost:3000/getAllBeers')
        .then(res => res.json())
        .then(res => {
            console.log('run')
            return res
        })
        .catch(err => {
            console.log('error occured', err)
        })
}

export { cronService }