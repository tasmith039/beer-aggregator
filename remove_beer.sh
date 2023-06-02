docker rm beer
docker rmi $(docker images 'beer-aggregator-web' -a -q)
