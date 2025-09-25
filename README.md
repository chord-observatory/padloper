# HIRAX Layout DB

A repository containing Python interface for accessing the HIRAX Layout DB, as well as the code for the web interface.

## How to start everything up

**N.B.**: It is possible to run everything in Docker: scroll to the end of this README for instructions on this option and for a quickstart guide. The information in this and subsequent sections is for installing everything by hand, which is probaby best for development environments and perhaps for some production environments.

Assuming that JanusGraph, Flask, and React are installed and configured (see sections below), we can start the JanusGraph server, followed by the Flask server, and then the React server for testing.

To start the JanusGraph server, do
```
cd janusgraph-full-0.x.xx/
bin/janusgraph.sh start
```

Once the JanusGraph server is started, we start the Flask server (using port 4300, which is currently the default port that the React server communicates with):
```
cd flask-interface/
flask run --no-debugger -p 4300
```

Once that is finished, open up another terminal and start the Oauth server
```
cd oauth-proxy-server
npm install # For the first time running the project
npm start
```

Finally, we start the React server:
```
cd web-interface/
npm start
```

## JanusGraph Installation Instructions

The following steps outline how to install [JanusGraph](https://janusgraph.org/) along with the [Apache Cassandra](https://cassandra.apache.org/) storage backend and the [Elasticsearch](https://www.elastic.co/elasticsearch/) indexing backend, as well as setting up [Gremlin-Python](https://pypi.org/project/gremlinpython/), which is used for querying the JanusGraph backend from a Python interface. The operating system used is Windows 10 running Windows Subsystem for Linux using Ubuntu 20.04.2 LTS, however the following instructions will work for native Ubuntu 20.04.2 LTS.

### Installing Java

JanusGraph is built on top of Apache TinkerPop, which, in turn, is built on top of Java and hence requires Java SE 8. The implementation of Java that we will install is OpenJDK 1.8. First, refresh the list of available packages:
```
sudo apt update
```

Next, install OpenJDK 1.8:
```
sudo apt install openjdk-8-jdk
```

To verify that the correct version has been installed, run `java -version`. A version similar to `openjdk version "1.8.0_292"` should be displayed.

### Setting the `$JAVA_HOME` environment variable

Head to `/usr/lib/jvm/` and locate the installation fo the JDK. It should look similar to `/usr/lib/jvm/java-8-openjdk-amd64`. Set the `$JAVA_HOME` environment variable to the point to the installation of the JDK:
```
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
```

### Setting up JanusGraph

From the [JanusGraph Releases](https://github.com/JanusGraph/janusgraph/releases), download the .zip of the "full" installation of the latest JanusGraph version (the file name should resemble `janusgraph-full-X.X.X.zip`, where `X.X.X` is the version number), and extract the contents. This "full" installation includes pre-configured JanusGraph, Apache Cassandra and Elasticsearch.

**Important**: You should follow all the steps below for proper functioning of
padloper.

* Add `schema.default=none` to the graph properties, i.e., to `conf/janusgraph-cql-es.properties`. This will only allow vertices/edges of the right type to be added and will throw an exception if you break the schema.
* The default memory settings can cause the JanusGraph to use quite a bit of RAM. Here are the parameters you can/should tune:
  * With the default settings, the biggest hog is the Cassandra backend (which uses 25% of the RAM or 8GB, whichever is less!). For something more reasonable, edit the `MAX_HEAP_SIZE` setting in `cassandra/conf/cassandra-env.sh`. You can set it to something like `512M` or `1024M`. So far 512 MB has proven perfectly adequate.
  * You can also set the JVM heap size for JanusGraph and the ElasticSearch backend. The relevant parameters are `-Xms` and `-Xmx` in each of `elasticsearch/config/jvm.options`, `conf/jvm-8.options` and `conf/jvm-11.options`. These represent the initial and maximum heap size allowed, respectively, and you should set them to the same value. For instance, for a heap size of 1 GB, set them to `-Xms1g` and `-Xmx1g`; for 512 MB, `-Xms512m` and `-Xmx512m`. If you put these settings in each of the configuration files listed earlier, then a total of 2 GB would be used.
* From here, start the JanusGraph server by running
  ```
  bin/janusgraph.sh start
  ```
* Finally, you need to define the schema and seed an initial admin. Open the Gremlin console as described in the next section, and execute the commands in the `index_setup.txt` file. This will:
  * Define all required vertex/edge properties (including the `permissions` list on user groups).
  * Create indices and trigger reindexing.
  * Seed a user named `master`, a user group named `admin` with broad permissions, and connect `admin` to `master`.

  Note: `index_setup.groovy` includes only the schema/indices and does not add the `permissions` property or seed the initial admin user/group. If you choose to run `index_setup.groovy`, also run the seeding commands from the end of `index_setup.txt` to create the initial admin.

## Connecting to JanusGraph

### Gremlin Console

Once connected to the JanusGraph server, we can open the Gremlin console by running
```
bin/gremlin.sh
```

Next, we may create a remote connection to the JanusGraph server. To use the variables when remotely accessing the Gremlin server using Gremlin console, we can connect to the server with a session:
```
:remote connect tinkerpop.server conf/remote.yaml session
```

From here, we can send commands to the JanusGraph server by preceding them with `:>`. We can avoid this by running
```
:remote console
```
which will enable sending all queries directly to the JanusGraph server and avoid the need of `:>`.


### Gremlin-Python

We can also access the JanusGraph server from a Python interface. First, we install the `gremlinpython` Python module by running
```
pip install gremlinpython
```

*Important*: make sure the version of `gremlinpython` is supported by your version of Janusgraph. For instance, for v0.6.2 of Janusgraph, more recent versions of `gremlinpython` are not supported and you have to do:
```
pip install gremlinpython==3.5.3
```

Now, we may create a Python file to connect to and query the graph:
```py
# Import full gremlinpython functionality
from gremlin_python import statics
from gremlin_python.structure.graph import Graph
from gremlin_python.process.graph_traversal import __
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection

# Instantiate a Gremlin Graph clientside
graph = Graph()

# Connect to the server, instantiate traversal of graph. Note that the server is opened on port 8182 by default.
g = graph.traversal().withRemote(DriverRemoteConnection('ws://localhost:8182/gremlin','g'))

# Get the vertices of the graph as a list, and print them.
print(g.V().toList())
```

This code will print a list of the vertices of the graph.

## Recommendation (deprecated): Update Netty version

*As of at least Janusgraph 0.6.2, this recommendation is deprecated, but is left here in case a similar issue arises in the future.*

> Using JanusGraph 0.5.3 or later versions, it is possible that a Netty version between 4.1.44 and 4.1.46 is used. To check, navigate to `lib/` and check the version numbers of `netty-all`, `netty-common`, `netty-buffer`, `netty-codec`, `netty-handler`, `netty-resolver`, and `netty-transport` files. These versions have a bug that may cause intermittent Apache Cassandra exceptions that become more frequent as the number of vertices and edges gets larger. Read [this GitHub issue](https://github.com/netty/netty/issues/10070) for more details.
> 
> If your Netty version is newer than 4.1.46, this section may be skipped. 
> 
> Otherwise, head to the [Maven repository for Netty](https://mvnrepository.com/artifact/io.netty) and download the latest (stable) versions for `netty-all`, `netty-common`, `netty-buffer`, `netty-codec`, `netty-handler`, `netty-resolver`, and `netty-transport`, and replace the old .jar files in `lib/` with these new files.

## Installing Flask

To install Flask, run the following command:
```
pip install -Iv Flask==2.0.1 
pip install -Iv python-dotenv==0.19.0
```
This will install `Flask` version 2.0.1 and `python-dotenv` version 0.19.0 (see the TODOs, updating these will make Flask not work), which will read the `.flaskenv` file in the flask-interface folder to configure the Flask server.

## Environment configuration

Copy `.env.template` to `.env` and set values as needed:

- `PROXY_SERVER_URL` — OAuth proxy base URL (e.g., `http://oauth-proxy-server:4000/` when using Docker Compose).
- `SECRET_KEY` — Flask secret key for sessions.
- `GITHUB_OAUTH_CLIENT_ID` — GitHub OAuth App Client ID (frontend + proxy).
- `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth App Client Secret (proxy only).

Notes:
- `.env` is ignored by git; do not commit secrets.
- When running via Docker Compose, the `.env` file at the repository root is injected into the `flask-interface` and `oauth-proxy-server` services automatically, and is also used for build-time args for the web interface.
- When running locally, the backend loads `.env` via `python-dotenv`.

## Authentication, Users, and Permissions

- Sign-in is via GitHub OAuth (the `oauth-proxy-server`). After successful OAuth in the web UI, the frontend calls the backend `/api/login` to establish a server-side session for your username and permissions.
- First login auto-provisioning: If your GitHub login does not yet exist as a `User` vertex, the backend creates it on first login so you can be assigned to groups immediately after.
- Write operations (adding/replacing vertices/edges) require an authenticated user; the backend associates your username with writes and enforces permissions.
- Initial admin: Running `index_setup.txt` seeds a `master` user and an `admin` user group with broad permissions. Use this account to bootstrap additional users/groups.
- Managing users/groups:
  - Create a user via the UI (Add Users) or POST `/api/new_user` with form data `username=...`. The current model identifies users by name.
  - Create a group via the UI (User Group Management) or POST `/api/new_usergroup` with form data `name=...` and `permissions=perm1;perm2;...`.
  - Assign users to groups via the UI (User Management), which posts to `/api/new_set_usergroup`.
  - Optional defaults: `padloper/scripts/init_user-groups.py` can seed Default/Protected/General groups, but is not required.

## Setting up React

In `web-interface`, run `npm install` to install all dependencies. However, `react-scripts` must be set to version `4.0.3` (see the TODOs). 


## Running Padloper in Docker

Padloper comes with ready-made scripts to launch the application in a set of Docker containers (for testing on a common platform and deployment). Ensure that you have an up-to-date
docker version that supports Docker Compose V2 (i.e., you can run `docker compose up`).

You can set up the containers by simply running:

```
docker compose up -d
```

The default address for the web interface is `localhost:4301` (under the `/padloper` base path), and is configurable in the `docker-compose.yml` file. When using the bundled nginx proxy you can also use `http://localhost:3000/padloper/`.

If you wish to add some sample data, exec into the `flask-interface` container and
run the setup scripts. For instance, to put in the toy model of a database included with
Padloper, run:

```
docker exec -it flask-interface sh -c "export PYTHONPATH=$PYTHONPATH:/; python3 padloper/scripts/init_simple-db.py"

### Troubleshooting

- 502 via nginx when calling `/api/*`:
  - Ensure the backend container is healthy and has all dependencies. Rebuild and restart just the backend with:
    - `docker compose build flask-interface`
    - `docker compose up -d flask-interface`
- Permission or “User not set” errors when writing:
  - Sign in via the UI (GitHub OAuth), and ensure your username exists in the database and belongs to a group that grants the required permissions (see Authentication, Users, and Permissions above).
```

### Brief explanation of Nginx and Gunicorn

For the dockerization, we added Gunicorn so that the backend is able to handle multiple requests
simultaneously since the built-in `flask` server is single-threaded is meant for development purposes.

Nginx provides provides another layer of managing requests and load balancing, in addition to providing a layer of security by hiding the Gunicorn server from the public internet.

## Quickstart

The steps below bring up a fresh system with persistent data using Docker Compose, initialize the database schema, and prepare admin access via your GitHub user.

1) Prerequisites
- Docker and Docker Compose V2 installed (so you can run `docker compose`).
- A GitHub OAuth App (Client ID/Secret) for sign-in.

2) Configure environment
- Copy `.env.template` to `.env` and set:
  - `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
  - `SECRET_KEY` (any secret string for Flask sessions)
  - Leave `PROXY_SERVER_URL` as default when using Compose.

3) Start services
```
docker compose up -d
```

4) Initialize schema and map your GitHub user to admin (one command)
- Easiest: run the helper (inside the repo, replace YOUR_GH_LOGIN):
```
bash scripts/bootstrap_graph.sh YOUR_GH_LOGIN
```

5) Use the app
- Sign in via GitHub. The header will log in to the backend and establish your session.
- Create users/groups via the UI (Manage Users) or APIs.

### Persistence across reboots
- Data persists in Docker named volumes defined in `docker-compose.yml`:
  - `cassandra_data`, `es_data`, `janusgraph_data`.
- These volumes survive container restarts and host reboots. After a reboot, run:
```
docker compose up -d
```
to bring containers back up. Avoid `docker compose down -v` unless you intend to wipe all data.

### Resetting data
Pick one based on how much you want to reset:

- Reset application containers only (keep data):
```
docker compose down
docker compose up -d --build
```

- Reset JanusGraph data (wipe graph) but keep app config:
```
docker compose down
docker volume rm padloper_user_cassandra_data padloper_user_es_data padloper_user_janusgraph_data
docker compose up -d
# Re-run schema + seeding:
bash scripts/bootstrap_graph.sh YOUR_GH_LOGIN
```

- Full reset (containers + data):
```
docker compose down -v
docker compose up -d --build
# Re-run schema + seeding as above
```

What to keep to avoid data loss:
- Do NOT remove the named volumes if you want to preserve graph data.
- Keep your `.env` file for OAuth/secret configuration.
- App images/containers can be rebuilt safely; data lives in the volumes.

### Notes on authentication
- The UI signs in via GitHub OAuth. After OAuth, it calls `/api/login` to set a server-side session (username + permissions).
- On first login, if your GitHub login does not yet exist as a `User` vertex, the backend auto‑creates it so you can be assigned to groups immediately after.
