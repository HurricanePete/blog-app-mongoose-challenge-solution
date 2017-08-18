const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function seedBlogData() {
	console.info('seeding blog data');
	const seedData = [];
	for (let i=1; i<=10; i++) {
		seedData.push(generateBlogData());
	}
	return BlogPost.insertMany(seedData);
}

function generateTitle() {
	const titles = ['Exciting Eggs', 'Powerful Pasta', 'Fantastic French Faire', 'Titillating Thai', 'Crepuscular Cantonese'];
	return titles[Math.floor(Math.random() * titles.length)];
}

function generateContent() {
	const contents = [
		'Krispy Kreme is the best. Period.', 
		'Only time will tell how delicious pasta is.', 
		'Soup dumplings are the saaviest.', 
		'That Panang Curry could not be trumped!',
		'Sexy sushi in a suave and sophisticated salon'
		];
	return contents[Math.floor(Math.random() * contents.length)];
}

function generateAuthorName() {
	const firstNames = ['Bill', 'Ted', 'Richard', 'Jennifer', 'Zelda'];
	const lastNames = ['Thompson', 'Smith', 'Adelade', 'Johnson', 'Kirk'];
	const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
	const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
	return {
		firstName: firstName,
		lastName: lastName
	}
}

function generateBlogData() {
	return {
		author: generateAuthorName(),
		title: generateTitle(),
		content: generateContent()
	}
}

function tearDownDb() {
	console.warn('Deleting database');
	return mongoose.connection.dropDatabase();
}

describe('Blogs API resource', function() {
	before(function() {
		return runServer(DATABASE_URL);
	});

	beforeEach(function() {
		return seedBlogData();
	});

	afterEach(function() {
		return tearDownDb();
	});

	after(function() {
		return closeServer();
	})

	describe('GET endpoint', function() {
		it('should return all existing blog posts', function() {
			let res;
			return chai.request(app)
			.get('/posts')
			.then(function(_res) {
				res = _res;
				res.should.have.status(200);
				res.body.should.have.length.of.at.least(1);
				return BlogPost.count();
			})
			.then(function(count) {
				res.body.length.should.equal(count);
			});
		});

		it('should return blogs with the right fields', function() {
			let resBlogs;
			return chai.request(app)
			.get('/posts')
			.then(function(res) {
				res.should.have.status(200);
				res.should.be.json;
				res.body.should.be.a('array');
				res.body.should.have.length.of.at.least(1);
				res.body.forEach(function(blog) {
					blog.should.be.a('object');
					blog.should.include.keys('author', 'title', 'content', 'created');
				});
				resBlogs = res.body[0];
				return BlogPost.findById(resBlogs.id);
			})
			.then(function(blog) {
				resBlogs.id.should.equal(blog.id);
				resBlogs.author.should.contain(blog.author.firstName && blog.author.lastName);
				resBlogs.title.should.equal(blog.title);
				resBlogs.content.should.equal(blog.content);
				const dateTransform = (blog.created).toISOString();
				resBlogs.created.should.equal(dateTransform, 'formatting issue between dates');
			});
		});
	});

	describe('POST endpoint', function() {
		it('should create a new post with the correct fields', function() {
			const newPost = generateBlogData();
			return chai.request(app)
			.post('/posts')
			.send(newPost)
			.then(function(res) {
				res.should.have.status(201);
				res.should.be.json;
				res.body.should.be.a('object');
				res.body.should.include.keys('author', 'title', 'content', 'created');
				res.body.id.should.not.be.null;
				res.body.title.should.equal(newPost.title);
				res.body.content.should.equal(newPost.content);
				res.body.author.should.contain(newPost.author.firstName && newPost.author.lastName);
			})
		})

		//add of test for missing field from input
		it('should throw an error when POST data is missing a field', function() {
			const badPost = {
				title: generateTitle(),
				author: generateAuthorName()
			}
			.then(function(req) {
				return chai.request(app)
				.post('/posts')
				.send(badPost)
			}).should.have.status(500)
		});
	});

	describe('PUT endpoint', function() {
		it('should update a post correctly', function() {
			const updateData = {
				title: 'TestTestTest',
				content: 'Look at all this test content!',
				author: {
					firstName: 'Testy',
					lastName: 'McTesterson'
				}
			} 
			return BlogPost
				.findOne()
				.exec()
				.then(function(blog) {
					updateData.id = blog.id;
					return chai.request(app)
					.put(`/posts/${blog.id}`)
					.send(updateData);
				})
				.then(function(res) {
					res.should.have.status(201);
					return BlogPost.findById(updateData.id).exec();
				})
				.then(function(blog) {
					blog.title.should.equal(updateData.title);
					blog.content.should.equal(updateData.content);
					blog.author.should.deep.contain(updateData.author);
					console.info(`${blog.author}, ${updateData.author.firstName}, ${updateData.author.lastName}`)
				});
		});
	});

	describe('DELETE endpoint', function() {
		it('should delete a selected post', function() {
			let blog;
			return BlogPost
				.findOne()
				.exec()
				.then(function(_blog) {
					blog = _blog;
					return chai.request(app)
					.delete(`/posts/${blog.id}`);
				})
				.then(function(res) {
					res.should.have.status(204)
					return BlogPost.findById(blog.id).exec();
				})
				.then(function(_blog) {
					should.not.exist(_blog);
				});
		});
	});
});